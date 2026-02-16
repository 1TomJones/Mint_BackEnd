export class HttpError extends Error {
  public readonly errorCode?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    public readonly statusCode: number,
    message: string,
    options?: {
      errorCode?: string;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "HttpError";
    this.errorCode = options?.errorCode;
    this.details = options?.details;
  }
}
