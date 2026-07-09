import { createHash, timingSafeEqual } from "crypto";
import { ADMIN_SECRET_HEADER } from "@/lib/contracts/admin";

export { ADMIN_SECRET_HEADER };

export class AdminAuthError extends Error {
  constructor(
    readonly code: "admin_not_configured" | "unauthorized",
    message: string,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export function requireAdminSecret(
  request: Request,
  adminSecret = process.env.ADMIN_SECRET,
) {
  if (!adminSecret) {
    throw new AdminAuthError(
      "admin_not_configured",
      "Admin access is not configured.",
    );
  }

  const suppliedSecret = request.headers.get(ADMIN_SECRET_HEADER);
  if (!suppliedSecret || !secretsEqual(suppliedSecret, adminSecret)) {
    throw new AdminAuthError("unauthorized", "Admin secret is invalid.");
  }
}

function secretsEqual(left: string, right: string) {
  const leftBuffer = createHash("sha256").update(left).digest();
  const rightBuffer = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftBuffer, rightBuffer);
}
