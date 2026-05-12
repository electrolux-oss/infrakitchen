import strawberry

from graphql_api.modules.blueprint.queries import BlueprintQuery
from graphql_api.modules.resource.queries import ResourceQuery
from graphql_api.modules.template.queries import TemplateQuery
from graphql_api.modules.integration.queries import IntegrationQuery
from graphql_api.modules.source_code.queries import SourceCodeQuery
from graphql_api.modules.source_code_version.queries import SourceCodeVersionQuery
from graphql_api.modules.secret.queries import SecretQuery
from graphql_api.modules.storage.queries import StorageQuery
from graphql_api.modules.executor.queries import ExecutorQuery
from graphql_api.modules.workflow.queries import WorkflowQuery
from graphql_api.modules.workspace.queries import WorkspaceQuery


@strawberry.type
class Query(
    BlueprintQuery,
    ResourceQuery,
    TemplateQuery,
    IntegrationQuery,
    SourceCodeQuery,
    SourceCodeVersionQuery,
    SecretQuery,
    StorageQuery,
    ExecutorQuery,
    WorkflowQuery,
    WorkspaceQuery,
):
    pass


schema = strawberry.Schema(query=Query)
