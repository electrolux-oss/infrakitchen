// Is used in Backstage plugin
export interface Options extends RequestInit {
  user?: {
    authenticated?: boolean;
    token?: string;
  };
}

class HttpError extends Error {
  constructor(
    public readonly message: any,
    public readonly status: any,
    public readonly body: any = null,
  ) {
    super(message);
    Object.setPrototypeOf(this, HttpError.prototype);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
    this.stack = new Error().stack;
  }
}

export const createHeadersFromOptions = (options: Options): Headers => {
  const requestHeaders = (options.headers ||
    new Headers({
      Accept: "application/json",
    })) as Headers;
  const hasBody = options && options.body;
  const isContentTypeSet = requestHeaders.has("Content-Type");
  const isGetMethod = !options?.method || options?.method === "GET";
  const isFormData = options?.body instanceof FormData;

  const shouldSetContentType =
    hasBody && !isContentTypeSet && !isGetMethod && !isFormData;
  if (shouldSetContentType) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (options.user && options.user.authenticated && options.user.token) {
    requestHeaders.set("Authorization", options.user.token);
  }

  return requestHeaders;
};

export const fetchJson = (url: string, options: Options = {}) => {
  const requestHeaders = createHeadersFromOptions(options);

  return fetch(url, { ...options, headers: requestHeaders })
    .then((response) =>
      response.text().then((text) => ({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: text,
      })),
    )
    .then(({ status, statusText, headers, body }) => {
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        new HttpError(e || statusText, status, e);
        // not json, no big deal
      }
      if (status < 200 || status >= 300) {
        return Promise.reject(
          new HttpError((json && json.message) || statusText, status, json),
        );
      }
      return Promise.resolve({ status, headers, body, json });
    });
};
