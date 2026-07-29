export function normalizeSpringBackendOrigin(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const url = new URL(value);
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (
    (url.protocol !== "https:" && !isLocalHttp) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "SPRING_BACKEND_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment.",
    );
  }

  return url.origin;
}
