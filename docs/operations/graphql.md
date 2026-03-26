# GraphQL API

InfraKitchen exposes a **GraphQL API** alongside the REST API, powered by [Strawberry GraphQL](https://strawberry.rocks/). It provides a flexible way to query all domain entities with field-level optimization — you only fetch the data you need.

---

## Endpoint

The GraphQL API is available at:

```
/api/graphql
```

This endpoint serves both the **GraphiQL interactive UI** (when opened in a browser) and standard **GraphQL POST requests**.

---

## Authentication

All queries require a valid **Bearer token** in the `Authorization` header. The same JWT tokens used for the REST API work with GraphQL.

```
Authorization: Bearer <your-token>
```

Without a token, queries return a GraphQL error:

```json
{
  "data": null,
  "errors": [
    {
      "message": "Not authenticated. Please provide a valid bearer token in the Authorization header."
    }
  ]
}
```

!!! tip "Obtaining a token"
    Use one of the authentication providers (GitHub, Microsoft, Service Account, etc.) to obtain a JWT token.
    For service accounts, use the `POST /api/auth/service_account/token` endpoint.

---

## Using the GraphiQL UI

The built-in GraphiQL UI is accessible at `/api/graphql` in the browser. To authenticate:

1. Open `/api/graphql` in your browser
2. Click the **Headers** tab at the bottom of the editor panel
3. Add your authorization header:

    ```json
    {
      "Authorization": "Bearer <your-token>"
    }
    ```

4. Write and run queries — the UI provides autocompletion and schema documentation

!!! note
    Schema introspection works without authentication, so autocompletion is available even before you add a token. However, executing any query requires a valid token.

---

## Available Entities

The GraphQL API exposes the following query types:

| Entity                  | Single query                    | List query              |
| :---------------------- | :------------------------------ | :---------------------- |
| **Executor**            | `executor(id: UUID)`            | `executors`             |
| **Integration**         | `integration(id: UUID)`         | `integrations`          |
| **Resource**            | `resource(id: UUID)`            | `resources`             |
| **Secret**              | `secret(id: UUID)`              | `secrets`               |
| **Source Code**         | `sourceCode(id: UUID)`          | `sourceCodes`           |
| **Source Code Version** | `sourceCodeVersion(id: UUID)`   | `sourceCodeVersions`    |
| **Storage**             | `storage(id: UUID)`             | `storages`              |
| **Template**            | `template(id: UUID)`            | `templates`             |
| **Workspace**           | `workspace(id: UUID)`           | `workspaces`            |

---

## Query Examples

### Fetch a single resource

```graphql
query {
  resource(id: "550e8400-e29b-41d4-a716-446655440000") {
    id
    name
    state
    status
    template {
      name
    }
    creator {
      name
    }
  }
}
```

### List templates with filtering, sorting, and pagination

All list queries support optional `filter`, `sort`, and `range` parameters:

```graphql
query {
  templates(
    filter: { name: "my-template" }
    sort: ["name", "ASC"]
    range: [0, 10]
  ) {
    id
    name
    description
    executors {
      name
      runtime
    }
  }
}
```

### Fetch executors with related entities

```graphql
query {
  executors {
    id
    name
    runtime
    sourceCode {
      name
      repository
    }
    storage {
      name
    }
    integrationIds {
      name
      provider
    }
  }
}
```

---

## Filtering, Sorting & Pagination

List queries accept three optional arguments:

| Parameter | Type        | Description                    | Example                                        |
| :-------- | :---------- | :----------------------------- | :--------------------------------------------- |
| `filter`  | `JSON`      | Key-value pairs to filter by   | `{ "name": "prod", "state": "provisioned" }`   |
| `sort`    | `[String!]` | Field name and direction       | `["created_at", "DESC"]`                       |
| `range`   | `[Int!]`    | Offset and limit for pagination | `[0, 25]`                                     |

These use the same filtering, sorting, and pagination logic as the REST API.

---

## Field-Level Optimization

The GraphQL API includes automatic **field-level query optimization**:

- **SQL column selection** — Only the database columns corresponding to requested GraphQL fields are loaded (`load_only`)
- **Relationship loading** — Related entities (e.g., `template`, `creator`, `sourceCode`) are eagerly loaded only when requested in the query
- **No N+1 queries** — Relationships use `selectinload` to batch-load in a single query

This means a simple query like `{ templates { id name } }` will only `SELECT id, name FROM templates` — no unnecessary data is fetched.

---

## Usage Examples

### cURL

```bash
curl -X POST /api/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"query": "{ templates { id name } }"}'
```
