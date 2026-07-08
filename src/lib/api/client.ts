export async function fetchJson<TResponse>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<TResponse> {
  const headers = new Headers(init?.headers);
  const hasFormDataBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (init?.body && !hasFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  const payload = (await response.json()) as TResponse;

  if (!response.ok) {
    const apiMessage = readApiErrorMessage(payload);
    throw new Error(
      apiMessage ?? `Request failed with status ${response.status}`,
    );
  }

  return payload;
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
