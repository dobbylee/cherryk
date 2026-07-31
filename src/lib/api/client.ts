import type { ZodType } from "zod";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export class ApiContractError extends Error {
  constructor() {
    super("Response did not match the expected API contract.");
    this.name = "ApiContractError";
  }
}

export async function fetchJson<TResponse>(
  input: RequestInfo | URL,
  schema: ZodType<TResponse>,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(input, prepareRequest(init));
  const payload = await readJsonBody(response);

  if (!response.ok) {
    const apiError = readApiError(payload);
    throw new ApiRequestError(
      apiError?.message ?? `Request failed with status ${response.status}`,
      response.status,
      apiError?.code,
    );
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiContractError();
  }
  return result.data;
}

export async function fetchNoContent(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<void> {
  const response = await fetch(input, prepareRequest(init));
  if (response.ok) {
    return;
  }

  const payload = await readJsonBody(response);
  const apiError = readApiError(payload);
  throw new ApiRequestError(
    apiError?.message ?? `Request failed with status ${response.status}`,
    response.status,
    apiError?.code,
  );
}

function prepareRequest(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  const hasFormDataBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (init?.body && !hasFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (init?.method ?? "GET").toUpperCase();
  if (
    !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method) &&
    !headers.has("X-XSRF-TOKEN")
  ) {
    const csrfToken = readCookie("XSRF-TOKEN");
    if (csrfToken) {
      headers.set("X-XSRF-TOKEN", csrfToken);
    }
  }

  return {
    ...init,
    headers,
  };
}

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const value = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function readApiError(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = payload.error;
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return {
        code:
          "code" in error && typeof error.code === "string"
            ? error.code
            : undefined,
        message: error.message,
      };
    }
  }

  return null;
}
