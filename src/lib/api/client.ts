export async function fetchJson<TResponse>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(input, prepareRequest(init));

  const payload = (await response.json()) as TResponse;

  if (!response.ok) {
    const apiMessage = readApiErrorMessage(payload);
    throw new Error(
      apiMessage ?? `Request failed with status ${response.status}`,
    );
  }

  return payload;
}

export async function fetchNoContent(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<void> {
  const response = await fetch(input, prepareRequest(init));
  if (response.ok) {
    return;
  }

  const payload = await response.json().catch(() => null);
  const apiMessage = readApiErrorMessage(payload);
  throw new Error(
    apiMessage ?? `Request failed with status ${response.status}`,
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

function readApiErrorMessage(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = payload.error;
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }
  }

  return null;
}
