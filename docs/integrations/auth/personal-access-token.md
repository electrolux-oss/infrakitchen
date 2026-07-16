# Personal Access Token

Personal access tokens let an existing InfraKitchen user authenticate to the API and CLI without using an interactive browser login.

This is useful for:

- Local CLI usage
- Short automation scripts run on behalf of a real user
- API testing in tools such as `curl`, Postman, or GraphiQL

Unlike service accounts, a personal access token always belongs to a real user and uses that user's permissions.

## How it works

When a user creates a personal access token:

- InfraKitchen generates a token in the format `ik_<token-id>_<secret>`
- Only the hashed token value is stored on the server
- The full token is shown exactly once in the UI
- The token can optionally have an expiration date
- The token remains valid until it expires or is deleted

Each successful use updates the token's `last_used_at` timestamp.

## Create a personal access token

1. Open your own user page in InfraKitchen
2. Find the **Personal Access Tokens** card
3. Click **Create Token**
4. Enter a descriptive name
5. Optionally set an expiration date, or use one of the predefined durations
6. Copy the token from the confirmation dialog and store it securely

!!! warning
    The full token value is only shown once. After the dialog closes, InfraKitchen only keeps and displays the token prefix.

Users can delete their own tokens at any time.

## Using the token

Use the token as a Bearer token in the `Authorization` header.

```bash
curl --location 'https://INFRA_KITCHEN_URL/api/graphql' \
--header 'Authorization: Bearer ik_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy' \
--header 'Content-Type: application/json' \
--data '{
  "query": "query PersonalAccessTokens { personalAccessTokens { id name tokenPrefix expiresAt lastUsedAt createdAt } }"
}'
```

This works with:

- GraphQL requests to `/api/graphql`
- REST API endpoints that use the standard bearer-token authentication flow
- CLI or other tooling that sends the token as `Authorization: Bearer ...`

## Security model

Personal access tokens inherit the permissions of the owning user.

Keep in mind:

- Anyone with the token can act as that user
- Tokens should be stored in a password manager or secret store
- Prefer setting an expiration date for temporary use cases
- Delete tokens that are no longer needed
- Do not embed tokens in source code or commit them to a repository

## Personal access tokens vs service accounts

Use a personal access token when:

- Actions should be attributed to a human user
- You want API access with the same permissions as your current account
- You need a simple token for local development or lightweight automation

Use a service account when:

- The integration should not depend on a human user
- You need dedicated machine credentials
- The account lifecycle should be managed independently from employee access
