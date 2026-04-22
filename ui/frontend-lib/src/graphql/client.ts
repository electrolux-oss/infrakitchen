import { GraphQLClient } from "graphql-request";

import { InfraKitchenApi } from "../api/InfraKitchenApi";

let _client: GraphQLClient | null = null;

/**
 * Initialise (or re-initialise) the shared GraphQL client.
 *
 * Called once at app startup with the ikApi so we can piggyback on its
 * auth token for every request.
 */
export function initGraphQLClient(
  ikApi: InfraKitchenApi,
  endpoint = "/api/graphql",
): GraphQLClient {
  const url = endpoint.startsWith("http")
    ? endpoint
    : new URL(endpoint, window.location.origin).href;
  _client = new GraphQLClient(url, {
    headers: {
      "Content-Type": "application/json",
    },
    requestMiddleware: async (request) => {
      const token = await ikApi.getToken();
      if (token) {
        return {
          ...request,
          headers: {
            "Content-Type": "application/json",
            ...(typeof request.headers === "object" &&
            !(request.headers instanceof Headers)
              ? request.headers
              : {}),
            Authorization: `Bearer ${token}`,
          },
        };
      }
      return request;
    },
  });
  return _client;
}

/**
 * Return the shared GraphQL client.
 * Throws if `initGraphQLClient` has not been called yet.
 */
export function getGraphQLClient(): GraphQLClient {
  if (!_client) {
    throw new Error(
      "GraphQL client has not been initialised. Call initGraphQLClient() first.",
    );
  }
  return _client;
}
