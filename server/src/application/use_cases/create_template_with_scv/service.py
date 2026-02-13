import logging

from application.source_code_versions.schema import SourceCodeVersionCreate
from application.source_code_versions.service import SourceCodeVersionService
from application.source_codes.schema import SourceCodeCreate
from application.source_codes.service import SourceCodeService
from application.templates.schema import TemplateCreate, TemplateResponse
from application.templates.service import TemplateService
from application.use_cases.create_template_with_scv.schema import TemplateCreateWithSCV
from core.audit_logs.handler import AuditLogHandler
from core.constants.model import ModelActions
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender
from core.users.model import UserDTO


logger = logging.getLogger(__name__)


class TemplateWithSCVService:
    def __init__(
        self,
        template_service: TemplateService,
        source_code_service: SourceCodeService,
        source_code_version_service: SourceCodeVersionService,
        revision_handler: RevisionHandler,
        source_code_event_sender: EventSender,
        source_code_version_event_sender: EventSender,
        audit_log_handler: AuditLogHandler,
    ):
        self.template_service: TemplateService = template_service
        self.source_code_service: SourceCodeService = source_code_service
        self.source_code_version_service: SourceCodeVersionService = source_code_version_service
        self.revision_handler: RevisionHandler = revision_handler
        self.source_code_event_sender: EventSender = source_code_event_sender
        self.source_code_version_event_sender: EventSender = source_code_version_event_sender
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def create(self, template_with_scv: TemplateCreateWithSCV, requester: UserDTO) -> TemplateResponse:
        """
        Create a new template.
        :param template_with_scv: TemplateCreateWithSCV to create
        :param requester: User who creates the template
        :return: Created template
        """
        body = template_with_scv.model_dump(exclude_unset=True)
        body["created_by"] = requester.id

        # Create Template
        body["template"] = body["name"].replace(" ", "_").lower()
        if body["integration_id"] == "":
            body["integration_id"] = None

        template = TemplateCreate.model_validate(body)
        template.abstract = False
        new_template = await self.template_service.create(template, requester=requester)

        # Create SourceCode
        # FIXME Looking for provider is broken when working with GitLab with a custom host
        # FIXME The Import Template from Repository feature enforce defining Git Integration ...
        # FIXME Use this data to enforce provider (and not try to "guess from URL")
        # FIXME Even if ... This code must check domain and not the full URL!
        repository = body["source_code_url"]
        if "github" in repository:
            body["source_code_provider"] = "github"
        elif "bitbucket" in repository:
            body["source_code_provider"] = "bitbucket"
        else:
            body["source_code_provider"] = "gitlab"
        #else:
        #    raise ValueError(f"Provider {repository!r} is not supported")

        sc = SourceCodeCreate.model_validate(body)
        new_sc = None
        existant_sc = await self.source_code_service.get_one(filter={"source_code_url": sc.source_code_url})
        if not existant_sc:
            new_sc = await self.source_code_service.create(sc, requester=requester)
        else:
            new_sc = existant_sc

        # Create SourceCodeVersion
        body["template_id"] = new_template.id
        body["source_code_id"] = new_sc.id

        scv = SourceCodeVersionCreate.model_validate(body)
        new_scv = await self.source_code_version_service.create(scv, requester=requester)

        await self.source_code_event_sender.send_task(new_sc.id, requester=requester, action=ModelActions.SYNC)
        await self.source_code_version_event_sender.send_task(new_scv.id, requester=requester, action=ModelActions.SYNC)

        return new_template
