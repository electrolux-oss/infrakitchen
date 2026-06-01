from strawberry.extensions import SchemaExtension


class GraphQLFailureFlagExtension(SchemaExtension):
    """Marks request state when a GraphQL operation contains errors.

    This allows request-scoped DB session teardown to rollback instead of
    committing, even when Strawberry converts resolver exceptions into
    GraphQL errors and continues returning HTTP 200.
    """

    def on_operation(self):
        yield

        execution_context = self.execution_context
        has_errors = bool(execution_context.pre_execution_errors)

        result = execution_context.result
        if result is not None and getattr(result, "errors", None):
            has_errors = True

        if not has_errors:
            return

        context = execution_context.context
        request = None
        if isinstance(context, dict):
            request = context.get("request")
        else:
            request = getattr(context, "request", None)

        if request is not None:
            request.state.graphql_failed = True
