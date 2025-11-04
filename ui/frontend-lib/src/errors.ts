export interface ApiErrorResponse {
  message: string;
  error_code: string;
  metadata: { [key: string]: any } | Array<any>;
}

export class ApiClientError extends Error {
  public status: number;
  public message: string;
  public error_code: string;
  public metadata: { [key: string]: any };

  constructor(
    status: number,
    detail: string,
    error_code: string,
    metadata: { [key: string]: any },
  ) {
    super(`${status} (${error_code}): ${detail}`);

    this.status = status;
    this.error_code = error_code;
    this.message = detail;
    this.metadata = metadata;

    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}
