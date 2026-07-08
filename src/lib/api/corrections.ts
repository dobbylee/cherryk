import type {
  CorrectionInput,
  CorrectionResponse,
} from "@/lib/contracts/correction";
import { fetchJson } from "./client";

export function submitCorrection(input: CorrectionInput) {
  return fetchJson<CorrectionResponse>("/api/v1/corrections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
