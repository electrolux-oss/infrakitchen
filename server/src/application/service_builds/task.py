import base64
from datetime import datetime, UTC
import logging
import os
import shutil
import tempfile
from uuid import UUID

import botocore.exceptions
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration, IntegrationDTO
from application.providers.aws.aws_client import AwsECR
from application.services.crud import ServiceCRUD
from application.services.model import Service
from application.source_codes.model import SourceCode
from core.adapters.provider_adapters import IntegrationProvider
from core.constants.model import ModelActions, ModelStatus
from core.custom_entity_log_controller import EntityLogger
from core.config import Settings
from core.errors import CannotProceed, PollLater
from core.tools.git_client import GitClient
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .builder import JOB_WORKSPACE, GitSource, ImageBuildRequest, ImageBuildResult, KubernetesJobBuilder
from .crud import ServiceBuildCRUD
from .ecr import EcrRepository, get_ecr_repository
from .model import ServiceBuild
from .schema import ServiceBuildResponse

logger = logging.getLogger(__name__)


def read_ssh_key(environment_variables: dict[str, str]) -> str | None:
    key_file = environment_variables.get("GIT_SSH")
    if not key_file or not os.path.exists(key_file):
        return None
    with open(key_file) as f:
        return f.read()


class ServiceBuildTask:
    def __init__(
        self,
        session: AsyncSession,
        crud: ServiceBuildCRUD,
        service_build_instance: ServiceBuild,
        service: Service,
        logger: EntityLogger,
        user: UserDTO,
        event_sender: EventSender,
        action: ModelActions,
        builder: KubernetesJobBuilder,
    ) -> None:
        self.session: AsyncSession = session
        self.crud: ServiceBuildCRUD = crud
        self.service_build_instance: ServiceBuild = service_build_instance
        self.service: Service = service
        self.logger: EntityLogger = logger
        self.user: UserDTO = user
        self.event_sender: EventSender = event_sender
        self.action: ModelActions = action
        self.builder: KubernetesJobBuilder = builder

    async def start_pipeline(self):
        if self.action != ModelActions.BUILD:
            raise CannotProceed(f"Unknown action: {self.action}")

        build = self.service_build_instance
        if build.status == ModelStatus.IN_PROGRESS:
            await self.check_job()
            return
        if build.status != ModelStatus.QUEUED:
            self.logger.info(f"Build is {build.status}, nothing to do")
            return

        self.logger.add_log_header(f"User: {self.user.identifier} Action: {self.action}")
        self.logger.info(f"Running on worker: {os.uname().nodename}")

        source_code = self.service.source_code
        if not source_code:
            raise CannotProceed("The service has no code repository")
        if not source_code.default_branch:
            raise CannotProceed("The code repository has not been synced yet")
        if not self.service.image_resource:
            raise CannotProceed("The service has no image repository resource")
        try:
            repository = get_ecr_repository(self.service.image_resource)
        except ValueError as e:
            raise CannotProceed(str(e)) from e

        aws_environment = await self.get_aws_environment(repository.integration)
        if build.version:
            await self.ensure_version_unused(aws_environment, repository, build.version)
        username, password = await self.get_registry_credentials(aws_environment, repository)
        image = f"{repository.url}:{build.commit_sha}"
        images = (image, f"{repository.url}:{build.version}") if build.version else (image,)
        labels = {
            "org.opencontainers.image.revision": build.commit_sha,
            "org.opencontainers.image.source": source_code.source_code_url,
        }

        build.started_at = datetime.now(UTC)
        build.image = image
        await self.change_status(ModelStatus.IN_PROGRESS)

        workspace_root = tempfile.mkdtemp(prefix="ik-build-")
        try:
            git_client = await self.get_git_client(source_code, workspace_root)
            source = GitSource(
                url=git_client.git_url,
                commit_sha=build.commit_sha,
                ssh_private_key=read_ssh_key(git_client.environment_variables),
            )
        finally:
            shutil.rmtree(workspace_root, ignore_errors=True)

        request = ImageBuildRequest(
            context_dir=os.path.normpath(os.path.join(JOB_WORKSPACE, self.service.build_context)),
            dockerfile=os.path.normpath(os.path.join(JOB_WORKSPACE, self.service.dockerfile_path)),
            images=images,
            registry=repository.registry,
            registry_username=username,
            registry_password=password,
            labels=labels,
        )
        self.logger.info(f"Building {', '.join(images)}")
        await self.builder.start(build.id, source, request, self.logger)
        raise PollLater("Build Job started", delay=self.builder.poll_seconds)

    async def check_job(self) -> None:
        started_at = self.service_build_instance.started_at
        if started_at:
            self.logger.execution_start = int(started_at.timestamp())
        try:
            result = await self.builder.poll(self.service_build_instance.id, self.logger)
        except ValueError as e:
            raise CannotProceed(f"Image build failed: {e}") from e
        if result is None:
            raise PollLater("Build Job is still running", delay=self.builder.poll_seconds)
        await self.finish(result)

    async def finish(self, result: ImageBuildResult) -> None:
        build = self.service_build_instance
        build.image_digest = result.digest
        build.finished_at = datetime.now(UTC)
        self.logger.add_result(image=build.image, digest=result.digest)
        self.logger.info(f"Pushed {build.image}@{result.digest}")
        await self.change_status(ModelStatus.DONE)

    async def get_git_client(self, source_code: SourceCode, workspace_root: str) -> GitClient:
        if not source_code.integration:
            provider_name = "git_public"
            kwargs: dict[str, object] = {"logger": self.logger}
        else:
            integration = IntegrationDTO.model_validate(source_code.integration)
            provider_name = integration.integration_provider
            kwargs = {"logger": self.logger, "configuration": integration.configuration}

        provider_adapter = IntegrationProvider.adapters.get(provider_name)
        if not provider_adapter:
            raise CannotProceed(f"Provider {provider_name} is not supported")
        provider_adapter_instance: IntegrationProvider = provider_adapter(**kwargs)
        provider_adapter_instance.workspace_root = workspace_root
        await provider_adapter_instance.authenticate()
        return await provider_adapter_instance.get_git_client(
            git_url=source_code.source_code_url,
            workspace_root=workspace_root,
            repo_name="service_repo",
        )

    async def get_aws_environment(self, integration: Integration) -> dict[str, str]:
        provider_adapter = IntegrationProvider.adapters.get("aws")
        if not provider_adapter:
            raise CannotProceed("AWS provider is not supported")
        aws = provider_adapter(
            logger=self.logger, configuration=IntegrationDTO.model_validate(integration).configuration
        )
        await aws.authenticate()
        return aws.environment_variables

    async def ensure_version_unused(
        self, aws_environment: dict[str, str], repository: EcrRepository, version: str
    ) -> None:
        try:
            async with AwsECR(aws_environment, repository.region).client as ecr:
                response = await ecr.describe_images(repositoryName=repository.name, imageIds=[{"imageTag": version}])
        except botocore.exceptions.ClientError as e:
            if e.response.get("Error", {}).get("Code") == "ImageNotFoundException":
                return
            raise CannotProceed(f"Could not check {repository.url} for version {version}: {e}") from e

        tags = [tag for detail in response.get("imageDetails", []) for tag in detail.get("imageTags", [])]
        other_tags = ", ".join(tag for tag in tags if tag != version) or "no other tags"
        raise CannotProceed(
            f"Version {version} is already pushed to {repository.url} ({other_tags}); "
            "change the service's version to build a new one"
        )

    async def get_registry_credentials(
        self, aws_environment: dict[str, str], repository: EcrRepository
    ) -> tuple[str, str]:
        try:
            async with AwsECR(aws_environment, repository.region).client as ecr:
                response = await ecr.get_authorization_token()
        except botocore.exceptions.ClientError as e:
            raise CannotProceed(
                f"Could not get an ECR token with integration {repository.integration.name}: {e}"
            ) from e

        token = base64.b64decode(response["authorizationData"][0]["authorizationToken"]).decode()
        username, _, password = token.partition(":")
        return username, password

    async def change_status(self, new_status: ModelStatus) -> None:
        self.service_build_instance.status = new_status
        await self.logger.save_log()
        await self.session.commit()
        await self.crud.refresh(self.service_build_instance)
        await self.event_sender.send_event(
            ServiceBuildResponse.model_validate(self.service_build_instance), ModelActions.UPDATE
        )
        try:
            await self.event_sender.flush()
        except Exception as e:
            # The status is already committed; don't let a lost UI event turn it into ERROR
            logger.warning(f"Failed to publish status event for build {self.service_build_instance.id}: {e}")

    async def make_failed(self) -> None:
        self.service_build_instance.finished_at = datetime.now(UTC)
        await self.change_status(ModelStatus.ERROR)

    async def make_retry(self, retry: int, max_retries: int):
        self.logger.warning(f"Retrying {retry}/{max_retries}")


async def get_service_build_task(
    session: AsyncSession,
    obj_id: UUID,
    user: UserDTO,
    action: ModelActions,
    trace_id: str | None = None,
    audit_log_id: UUID | None = None,
) -> ServiceBuildTask:
    crud = ServiceBuildCRUD(session=session)
    build = await crud.get_by_id(obj_id)
    if not build:
        raise CannotProceed(f"Service build {obj_id} not found")

    service = await ServiceCRUD(session=session).get_by_id(build.service_id)
    if not service:
        raise CannotProceed(f"Service {build.service_id} not found")

    return ServiceBuildTask(
        session=session,
        crud=crud,
        service_build_instance=build,
        service=service,
        logger=EntityLogger(
            entity_name="service_build",
            entity_id=build.id,
            trace_id=trace_id,
            audit_log_id=audit_log_id,
        ),
        user=user,
        event_sender=EventSender(entity_name="service_build"),
        action=action,
        builder=KubernetesJobBuilder(Settings()),
    )
