import {
  CorrectionResponseSchema,
  type CorrectionInput,
} from "@/lib/contracts/correction";
import { fetchJson } from "./client";

export function submitCorrection(input: CorrectionInput) {
  return fetchJson("/api/v1/corrections", CorrectionResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
