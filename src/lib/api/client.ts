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
    throw new Error(`Request failed with status ${response.status}`);
  }

  return payload;
}
