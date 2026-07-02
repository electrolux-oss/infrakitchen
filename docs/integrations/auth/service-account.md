# Service Account

Service accounts in InfraKitchen are designed to facilitate machine-to-machine communication and automation within the InfraKitchen ecosystem.
They provide a mechanism for external tools, scripts, and CI/CD pipelines to interact with InfraKitchen APIs without requiring an interactive user session.

## Setup Steps

1. Navigate to **auth providers** and create an authProvider with type `ik_service_account`
2. Navigate to **users** and create a user
3. Navigate to the newly created user and add desired permissions

## Generate Token

To generate the token, call the GraphQL API:

```bash
curl --location 'https://INFRA_KITCHEN_URL/api/graphql' \
--header 'Content-Type: application/json' \
--data '{
  "query": "mutation ServiceAccountToken($identifier: String!, $password: String!) { serviceAccountToken(identifier: $identifier, password: $password) { token expiresAt } }",
  "variables": {
    "identifier": "username",
    "password": "password"
  }
}'
```

The legacy `POST /api/auth/service_account/token` endpoint remains available but is deprecated.

## Using the Token

You can then call the API as the service account by adding the authorization bearer token header to your requests:

```bash
curl --location 'https://INFRA_KITCHEN_URL/api/your-endpoint' \
--header 'Authorization: Bearer YOUR_TOKEN_HERE' \
--header 'Content-Type: application/json'
```
