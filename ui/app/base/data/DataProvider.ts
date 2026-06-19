import {
  ApiClientError,
  ApiErrorResponse,
  InfraKitchenApi,
} from "@electrolux-oss/infrakitchen";

import inMemoryToken from "../auth/inMemoryToken";

export interface IKDataProvider extends InfraKitchenApi {
  getToken: () => Promise<string | null>;
  graphqlRequest: <T>(
    query: string,
    variables?: Record<string, any>,
  ) => Promise<T>;
  // user permissions
  [key: string]: (...args: any[]) => Promise<any>;
}

type GraphqlErrorResponse = {
  message?: string;
  extensions?: {
    error_code?: string;
    metadata?: ApiErrorResponse["metadata"];
  };
};

const GRAPHQL_ERROR_STATUS = 400;

const toApiClientError = (
  status: number,
  errorBody: Partial<ApiErrorResponse>,
): ApiClientError | null => {
  if (errorBody.message && errorBody.error_code) {
    return new ApiClientError(
      status,
      errorBody.message,
      errorBody.error_code,
      errorBody.metadata || {},
    );
  }

  if (errorBody.message) {
    return new ApiClientError(
      status,
      errorBody.message,
      "unknown_error",
      errorBody.metadata || {},
    );
  }

  return null;
};

const parseErrorBody = async (response: Response): Promise<void> => {
  let errorBody: ApiErrorResponse;
  try {
    errorBody = await response.json();
  } catch (_) {
    throw new Error(`${response.status} ${response.statusText}.`);
  }

  const apiError = toApiClientError(response.status, errorBody);
  if (apiError) {
    throw apiError;
  }

  throw new Error(`${response.status} ${response.statusText}.`);
};

const parseGraphqlError = (errors: GraphqlErrorResponse[]): never => {
  const firstError = errors[0];

  if (!firstError) {
    throw new Error("GraphQL request failed");
  }

  const apiError = toApiClientError(GRAPHQL_ERROR_STATUS, {
    message: firstError.message || "GraphQL request failed",
    error_code: firstError.extensions?.error_code,
    metadata: firstError.extensions?.metadata || {},
  });

  if (apiError) {
    throw apiError;
  }

  throw new Error("GraphQL request failed");
};

export const ikDataProvider = (apiUrl: string): IKDataProvider => {
  const fetchWithAuth = async (url: string, options: any = {}) => {
    const token = inMemoryToken.getToken();

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.append("Authorization", `Bearer ${token}`);
    }

    const updatedOptions: any = {
      ...options,
      headers,
    };

    return fetch(url, updatedOptions);
  };

  return {
    getToken: async () => {
      const token = inMemoryToken.getToken();
      return token;
    },

    graphqlRequest: async <T>(
      query: string,
      variables?: Record<string, any>,
    ) => {
      const url = `${apiUrl}/graphql`;
      const response = await fetchWithAuth(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
      if (!response.ok) {
        await parseErrorBody(response);
      }
      const json = await response.json();
      if (Array.isArray(json?.errors) && json.errors.length > 0) {
        parseGraphqlError(json.errors);
      }
      return json.data as T;
    },
  };
};

export const addRefreshAuthToDataProvider = (
  provider: IKDataProvider,
  refreshAuth: () => Promise<void>,
): IKDataProvider => {
  const proxy = new Proxy(provider, {
    get(_, name) {
      return async (...args: any[]) => {
        await refreshAuth();
        return provider[name.toString()](...args);
      };
    },
  });

  return proxy;
};
