import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/contracts/common";

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json<ApiError>(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}
