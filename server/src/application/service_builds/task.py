from datetime import datetime, UTC
import logging
import os
import shutil
import tempfile
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration, IntegrationDTO
from application.services.crud import ServiceCRUD
from application.services.model import Service
from application.source_codes.model import SourceCode
from core.adapters.provider_adapters import ContainerRegistryProvider, IntegrationProvider
from core.constants.model import ModelActions, ModelStatus
from core.custom_entity_log_controller import EntityLogger
from core.config import Settings
from core.errors import CannotProceed, CloudWrongCredentials
from core.tools.git_client import GitClient
from core.users.model import UserDTO
from core.utils.event_sender import EventSender

from .builder import (
    JOB_WORKSPACE,
    GitSource,
    ImageBuildRequest,
    ImageBuildResult,
    KubernetesJobBuilder,
    RegistryLogin,
)
from .crud import ServiceBuildCRUD
from .model import BuildImage, ServiceBuild
from .registry import get_container_registry
from .schema import ServiceBuildResponse

logger = logging.getLogger(__name__)


def read_ssh_key(environment_variables: dict[str, str]) -> str | None:
    key_file = environment_variables.get("GIT_SSH")
    if not key_file or not os.path.exists(key_file):
        return None
    with open(key_file) as f:
        return f.read()


def without_credentials(url: str) -> str:
    parts = urlsplit(url)
    if not parts.scheme or "@" not in parts.netloc:
        return url
    return urlunsplit(parts._replace(netloc=parts.netloc.rsplit("@", 1)[1]))


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
            self.logger.info("Following the build Job again from its start")
            await self.wait_for_job()
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
        if not build.images:
            raise CannotProceed("The build has no image registry to push to")

        # A failed build of the same commit and tag may have pushed to some registries before failing
        retrying_tag = await self.crud.started_failed_build_exists(
            build.service_id, build.commit_sha, build.tag, exclude_id=build.id
        )
        logins: dict[str, RegistryLogin] = {}
        login_integrations: dict[str, Integration] = {}
        push_identities: set[str] = set()
        images: list[BuildImage] = []
        for image in build.images:
            integration = await self.session.get(Integration, UUID(image["registry_integration_id"]))
            if not integration:
                raise CannotProceed(f"The image registry {image['registry_name']} no longer exists")
            registry, login = await self.registry_login(integration)
            other = login_integrations.get(login.registry)
            if other is not None and other.id != integration.id:
                raise CannotProceed(
                    f"{other.name} and {integration.name} both log in to {login.registry}, but a build can only use "
                    "one login per registry; push to repositories of one integration"
                )
            repository_url = f"{login.registry}/{image['image_repository']}"
            if not retrying_tag:
                await self.ensure_tag_unused(registry, image["image_repository"], repository_url, build.tag)
            pushed = image.copy()
            pushed["image"] = f"{repository_url}:{build.tag}"
            images.append(pushed)
            logins[login.registry] = login
            login_integrations[login.registry] = integration
            identity = registry.credential_identity()
            if identity is not None:
                push_identities.add(identity)
        build.images = images

        push_integration_ids = {image["registry_integration_id"] for image in build.images}
        pull_logins: dict[str, RegistryLogin] = {}
        for integration in self.service.base_image_registries:
            # The build step can read its pull credentials
            if str(integration.id) in push_integration_ids:
                raise CannotProceed(
                    f"The service pushes with {integration.name}, so it can't also pull base images with it"
                )
            registry, login = await self.registry_login(integration)
            if registry.credential_identity() in push_identities:
                raise CannotProceed(
                    f"{integration.name} uses the same cloud identity as a registry the service pushes to, so its "
                    "login could push; pull base images with a read-only identity"
                )
            pull_logins[login.registry] = login

        build.started_at = datetime.now(UTC)
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
            images=tuple(image["image"] for image in build.images if image["image"]),
            logins=tuple(logins.values()),
            pull_logins=tuple(pull_logins.values()),
            labels={
                "org.opencontainers.image.revision": build.commit_sha,
                "org.opencontainers.image.source": without_credentials(source_code.source_code_url),
            },
            platforms=tuple(build.platforms),
        )
        platforms = f" for {', '.join(request.platforms)}" if request.platforms else ""
        for name in request.images:
            self.logger.info(f"Building {name}{platforms}")
        await self.builder.start(build.id, source, request, self.logger)
        await self.change_status(ModelStatus.IN_PROGRESS)
        await self.wait_for_job()

    async def registry_login(self, integration: Integration) -> tuple[ContainerRegistryProvider, RegistryLogin]:
        registry = await get_container_registry(self.session, integration, self.logger)
        try:
            credentials = await registry.get_registry_credentials()
        except CloudWrongCredentials as e:
            raise CannotProceed(f"Could not log in to {integration.name}: {e}") from e
        return registry, RegistryLogin(credentials.registry_host, credentials.username, credentials.password)

    async def wait_for_job(self) -> None:
        started_at = self.service_build_instance.started_at
        if started_at:
            self.logger.execution_start = int(started_at.timestamp())
        try:
            result = await self.builder.wait(self.service_build_instance.id, self.logger)
        except ValueError as e:
            raise CannotProceed(f"Image build failed: {e}") from e
        await self.finish(result)

    async def finish(self, result: ImageBuildResult) -> None:
        build = self.service_build_instance
        build.image_digest = result.digest
        build.finished_at = datetime.now(UTC)
        images = [image["image"] for image in build.images if image["image"]]
        self.logger.add_result(images=images, digest=result.digest)
        for name in images:
            self.logger.info(f"Pushed {name}@{result.digest}")
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

    async def ensure_tag_unused(
        self, registry: ContainerRegistryProvider, repository: str, repository_url: str, tag: str
    ) -> None:
        try:
            exists = await registry.image_tag_exists(repository, tag)
        except (httpx.HTTPError, ValueError) as e:
            raise CannotProceed(f"Could not check {repository_url} for tag {tag}: {e}") from e
        if exists:
            raise CannotProceed(f"{repository_url}:{tag} is already pushed; build with another tag")

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
        await self.builder.stop(self.service_build_instance.id, self.logger)
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
