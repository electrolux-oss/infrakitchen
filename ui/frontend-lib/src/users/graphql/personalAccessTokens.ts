export const PERSONAL_ACCESS_TOKEN_FIELDS = `
  id
  name
  tokenPrefix
  expiresAt
  lastUsedAt
  revokedAt
  createdAt
`;

export const PERSONAL_ACCESS_TOKENS_QUERY = `
  query PersonalAccessTokens {
    personalAccessTokens {
      ${PERSONAL_ACCESS_TOKEN_FIELDS}
    }
  }
`;

export const CREATE_PERSONAL_ACCESS_TOKEN_MUTATION = `
  mutation CreatePersonalAccessToken($input: PersonalAccessTokenCreateInput!) {
    createPersonalAccessToken(input: $input) {
      ${PERSONAL_ACCESS_TOKEN_FIELDS}
      token
    }
  }
`;

export const DELETE_PERSONAL_ACCESS_TOKEN_MUTATION = `
    mutation DeletePersonalAccessToken($id: UUID!) {
      deletePersonalAccessToken(id: $id)
    }
`;

export interface GqlPersonalAccessToken {
  id: string;
  name: string;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface GqlPersonalAccessTokenCreate extends GqlPersonalAccessToken {
  token: string;
}

export interface PersonalAccessTokenInput {
  name: string;
  expiresAt: string | null;
}
