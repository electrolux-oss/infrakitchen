from fastapi import APIRouter, Depends

from core import check_api_permission
from core.sso import auth_router, get_logged_user

from core.workers import api as workers_api
from core.logs import api as logs_api
from core.audit_logs import api as audit_logs_api
from core.users import api as users_api
from core.auth_providers import api as auth_providers_api
from core.permissions import api as permissions_api
from core.tasks import api as tasks_api
from core.constants import api as constants
from core.cloud_resources import api as cloud_resources_api
from core.revisions import api as revisions_api
from core.scheduler import api as scheduler_api
from core.labels import api as labels_api
from core.feature_flags import api as feature_flags_api

from ..use_cases import views as use_cases_api
from ..views import entities_view as entities
from ..views import resource_variables_view as resource_variables
from ..views import download_source_code as download_source_code
from ..views import github_view as github
from ..views import bitbucket_view as bitbucket
from ..views import azure_devops_view as azure_devops
from ..views import kubernetes_view as kubernetes
from ..templates import api as templates_api
from ..resources import api as resources_api
from ..resource_temp_state import api as resource_temp_state_api
from ..source_codes import api as source_codes_api
from ..integrations import api as integrations_api
from ..source_code_versions import api as source_code_versions_api
from ..storages import api as storages_api
from ..secrets import api as secrets_api
from ..workspaces import api as workspaces_api
from ..executors import api as executors_api
from ..views.websocket_view import router as websocket
from ..views import administration_views as administration
from ..views import config_view as config
from ..views import user_permission_view as user
from ..validation_rules import api as validation_rules_api

api = APIRouter(dependencies=[Depends(get_logged_user), Depends(check_api_permission)])

api.include_router(
    use_cases_api.router,
    tags=["Core", "Use Cases"],
)

api.include_router(
    entities.router,
    tags=["Core"],
)

api.include_router(
    administration.router,
    tags=["Core", "Administration"],
)

api.include_router(
    constants.router,
    tags=["Core"],
)

api.include_router(
    cloud_resources_api.router,
    tags=["Core"],
)

api.include_router(
    github.router,
    tags=["Core", "Github"],
)

api.include_router(
    bitbucket.router,
    tags=["Core", "Bitbucket"],
)

api.include_router(
    azure_devops.router,
    tags=["Core", "Azure DevOps"],
)

api.include_router(
    kubernetes.router,
    tags=["Core", "Kubernetes"],
)

api.include_router(
    templates_api.router,
    tags=["Core"],
)

api.include_router(
    resources_api.router,
    tags=["Core"],
)

api.include_router(
    source_codes_api.router,
    tags=["Core"],
)

api.include_router(
    integrations_api.router,
    tags=["Core"],
)

api.include_router(
    source_code_versions_api.router,
    tags=["Core"],
)

api.include_router(
    resource_variables.router,
    tags=["Core"],
)

api.include_router(
    download_source_code.router,
    tags=["Core"],
)

api.include_router(
    storages_api.router,
    tags=["Core"],
)

api.include_router(
    secrets_api.router,
    tags=["Core"],
)

api.include_router(
    workspaces_api.router,
    tags=["Core", "Workspaces"],
)

api.include_router(
    executors_api.router,
    tags=["Core", "Executors"],
)

api.include_router(
    workers_api.router,
    tags=["Core"],
)

api.include_router(
    logs_api.router,
    tags=["Core"],
)

api.include_router(
    audit_logs_api.router,
    tags=["Core"],
)

api.include_router(
    users_api.router,
    tags=["Core", "Users"],
)

api.include_router(
    auth_providers_api.router,
    tags=["Core"],
)

api.include_router(
    permissions_api.router,
    tags=["Core", "Permissions"],
)

api.include_router(
    revisions_api.router,
    tags=["Core", "Revisions"],
)

api.include_router(
    tasks_api.router,
    tags=["Core", "Tasks"],
)

api.include_router(
    labels_api.router,
    tags=["Core", "Labels"],
)

api.include_router(
    constants.router,
    tags=["Core"],
)

api.include_router(
    scheduler_api.router,
    tags=["Core"],
)

api.include_router(
    resource_temp_state_api.router,
    tags=["Core"],
)

api.include_router(
    feature_flags_api.router,
    tags=["Core"],
)

api.include_router(
    validation_rules_api.router,
    tags=["Core"],
)

main_router = APIRouter(prefix="/api")
main_router.include_router(api)
main_router.include_router(auth_router)
main_router.include_router(config.router)
main_router.include_router(user.router)
main_router.include_router(websocket)
