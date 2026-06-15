import strawberry
from graphql_api.extensions import GraphQLFailureFlagExtension

from graphql_api.modules.config.queries import ConfigQuery
from graphql_api.modules.auth_provider.queries import AuthProviderQuery
from graphql_api.modules.audit_log.queries import AuditLogQuery
from graphql_api.modules.event.subscriptions import EventSubscription
from graphql_api.modules.log.subscriptions import LogSubscription
from graphql_api.modules.notification.subscriptions import NotificationSubscription
from graphql_api.modules.batch_operation.queries import BatchOperationQuery
from graphql_api.modules.blueprint.queries import BlueprintQuery
from graphql_api.modules.resource.queries import ResourceQuery
from graphql_api.modules.template.queries import TemplateQuery
from graphql_api.modules.template.mutations import TemplateMutation
from graphql_api.modules.integration.queries import IntegrationQuery
from graphql_api.modules.label.queries import LabelQuery
from graphql_api.modules.source_code.queries import SourceCodeQuery
from graphql_api.modules.source_code.mutations import SourceCodeMutation
from graphql_api.modules.source_code_version.queries import SourceCodeVersionQuery
from graphql_api.modules.secret.queries import SecretQuery
from graphql_api.modules.storage.queries import StorageQuery
from graphql_api.modules.executor.queries import ExecutorQuery
from graphql_api.modules.favorite.queries import FavoriteQuery
from graphql_api.modules.favorite.mutations import FavoriteMutation
from graphql_api.modules.permission.queries import PermissionQuery
from graphql_api.modules.resource_temp_state.queries import ResourceTempStateQuery
from graphql_api.modules.revision.queries import RevisionQuery
from graphql_api.modules.task.queries import TaskQuery
from graphql_api.modules.workflow.queries import WorkflowQuery
from graphql_api.modules.workspace.queries import WorkspaceQuery
from graphql_api.modules.worker.queries import WorkerQuery
from graphql_api.modules.providers.slack.queries import SlackQuery
from graphql_api.modules.providers.slack.mutations import SlackMutation
from graphql_api.modules.user.queries import UserQuery
from graphql_api.modules.user.mutations import UserMutation
from graphql_api.modules.notification.queries import NotificationQuery
from graphql_api.modules.notification.mutations import NotificationMutation
from graphql_api.modules.resource.mutations import ResourceMutation
from graphql_api.modules.log.queries import LogQuery
from graphql_api.modules.validation_rule.queries import ValidationRuleQuery
from graphql_api.modules.auth.mutations import AuthMutation


@strawberry.type
class Query(
    ConfigQuery,
    AuthProviderQuery,
    AuditLogQuery,
    BatchOperationQuery,
    BlueprintQuery,
    ResourceQuery,
    TemplateQuery,
    IntegrationQuery,
    LabelQuery,
    SourceCodeQuery,
    SourceCodeVersionQuery,
    SecretQuery,
    StorageQuery,
    ExecutorQuery,
    FavoriteQuery,
    PermissionQuery,
    ResourceTempStateQuery,
    RevisionQuery,
    TaskQuery,
    WorkflowQuery,
    WorkspaceQuery,
    WorkerQuery,
    SlackQuery,
    UserQuery,
    LogQuery,
    ValidationRuleQuery,
    NotificationQuery,
):
    pass


@strawberry.type
class Mutation(
    AuthMutation,
    SlackMutation,
    UserMutation,
    NotificationMutation,
    ResourceMutation,
    TemplateMutation,
    SourceCodeMutation,
    FavoriteMutation,
):
    pass


@strawberry.type
class Subscription(
    EventSubscription,
    LogSubscription,
    NotificationSubscription,
):
    pass


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    subscription=Subscription,
    extensions=[GraphQLFailureFlagExtension],
)
