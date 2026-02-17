import {
  ApiClientError,
  ApiErrorResponse,
  GetListParams,
  InfraKitchenApi,
  ResourceVariableSchema,
} from "@electrolux-oss/infrakitchen";
import queryString from "query-string";

import inMemoryToken from "../auth/inMemoryToken";

export interface IKDataProvider extends InfraKitchenApi {
  getToken: () => Promise<string | null>;
  getVariableSchema: (
    id: string,
    parent_resources?: string[],
  ) => Promise<ResourceVariableSchema[]>;
  downloadFile(path: string): Promise<ArrayBuffer>;
  getTree: (
    component: string,
    id: number | string,
    direction: "parents" | "children",
  ) => Promise<any>;
  // user permissions
  get(path: string, params?: Record<string, any>): Promise<any>;
  postRaw: (path: string, params: { [key: string]: any }) => Promise<any>;
  updateRaw: (path: string, params: { [key: string]: any }) => Promise<any>;
  deleteRaw: (path: string, params: { [key: string]: any }) => Promise<any>;
  patchRaw: (path: string, params: { [key: string]: any }) => Promise<any>;
  getList: (entity: string, params: GetListParams) => Promise<any>;
  [key: string]: (...args: any[]) => Promise<any>;
}

const parseErrorBody = async (response: Response): Promise<void> => {
  let errorBody: ApiErrorResponse;
  try {
    errorBody = await response.json();
  } catch (_) {
    throw new Error(`${response.status} ${response.statusText}.`);
  }

  if (errorBody && errorBody.message && errorBody.error_code) {
    throw new ApiClientError(
      response.status,
      errorBody.message,
      errorBody.error_code,
      errorBody.metadata,
    );
  }

  if (errorBody && errorBody.message) {
    throw new ApiClientError(
      response.status,
      errorBody.message,
      "unknown_error",
      errorBody.metadata || {},
    );
  }

  throw new Error(`${response.status} ${response.statusText}.`);
};

export const ikDataProvider = (apiUrl: string): IKDataProvider => {
  const httpClient = (url: string, options: any = {}) => {
    if (!options.headers) {
      options.headers = new Headers({ Accept: "application/json" });
    }
    const token = inMemoryToken.getToken();
    if (token) {
      options.headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, options).then(async (response) => {
      if (!response.ok) {
        await parseErrorBody(response);
      }

      const text = await response.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error(`Failed to parse JSON response: ${e}`);
      }
      return {
        status: response.status,
        headers: response.headers,
        body: text,
        json,
      };
    });
  };

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

    get: async (entity, params) => {
      const url = `${apiUrl}/${entity}?${queryString.stringify(params || {})}`;
      const response = await fetchWithAuth(url.toString());
      if (!response.ok) {
        await parseErrorBody(response);
      }
      try {
        const json = await response.json();
        return json;
      } catch (e) {
        throw new Error(`Failed to parse JSON response: ${e}`);
      }
    },

    downloadFile: async (path: string) => {
      const url = `${apiUrl}/${path}`;
      const response = await fetchWithAuth(url);
      if (!response.ok) {
        await parseErrorBody(response);
      }
      return await response.arrayBuffer();
    },

    getVariableSchema: async (id: string, parent_resources?: string[]) => {
      const parentResourcesQuery = parent_resources
        ? parent_resources.join(",")
        : "";
      const url = `${apiUrl}/source_code_versions/${id}/variables?parent_resources=${parentResourcesQuery}`;
      return httpClient(url).then(({ json }) => json);
    },

    getTree: (
      component: string,
      id: number | string,
      direction: "parents" | "children" = "children",
    ) =>
      httpClient(`${apiUrl}/${component}/${id}/tree/${direction}`).then(
        ({ json }) => json,
      ),

    updateRaw: async (path: string, params: { [key: string]: any }) => {
      const url = `${apiUrl}/${path}`;
      const response = await fetchWithAuth(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        await parseErrorBody(response);
      }
      try {
        const json = await response.json();
        return json;
      } catch (e) {
        throw new Error(`Failed to parse JSON response: ${e}`);
      }
    },

    postRaw: async (path: string, params: { [key: string]: any }) => {
      const url = `${apiUrl}/${path}`;
      const response = await fetchWithAuth(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        await parseErrorBody(response);
      }
      try {
        const json = await response.json();
        return json;
      } catch (e) {
        throw new Error(`Failed to parse JSON response: ${e}`);
      }
    },

    deleteRaw: async (path: string, params: { [key: string]: any }) => {
      const url = `${apiUrl}/${path}`;
      const response = await fetchWithAuth(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        await parseErrorBody(response);
      }
      return await response.text();
    },

    patchRaw: async (path: string, params: { [key: string]: any }) => {
      const url = `${apiUrl}/${path}`;
      const response = await fetchWithAuth(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        await parseErrorBody(response);
      }
      try {
        const json = await response.json();
        return json;
      } catch (e) {
        throw new Error(`Failed to parse JSON response: ${e}`);
      }
    },

    // administration API
    getList: async (entity, params) => {
      const { page, perPage } = params.pagination || { page: 1, perPage: 10 };
      const { field, order } = params.sort || { field: "id", order: "ASC" };
      const fields = params.fields || [];

      const rangeStart = (page - 1) * perPage;
      const rangeEnd = page * perPage;

      const query = {
        sort: JSON.stringify([field, order]),
        range: JSON.stringify([rangeStart, rangeEnd]),
        filter: JSON.stringify(params.filter),
        fields: fields.length > 0 ? JSON.stringify(fields) : undefined,
      };

      const url = `${apiUrl}/${entity}?${queryString.stringify(query)}`;
      const response = await fetchWithAuth(url.toString());
      if (!response.ok) {
        await parseErrorBody(response);
      }
      try {
        const json = await response.json();
        // Example Content-Range header:
        // Content-Range: items 0-24/66
        const contentRangeHeader = response.headers.get("Content-Range");

        let total = 0;

        if (contentRangeHeader) {
          const slashIndex = contentRangeHeader.indexOf("/");

          if (slashIndex !== -1) {
            const totalString = contentRangeHeader.substring(slashIndex + 1);
            const parsedTotal = parseInt(totalString, 10);
            if (!isNaN(parsedTotal)) {
              total = parsedTotal;
            }
          }
        }
        const finalTotal = total > 0 ? total : json.length;
        return {
          data: json,
          total: finalTotal,
        };
      } catch (e) {
        throw new Error(`Failed to parse JSON response: ${e}`);
      }
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
