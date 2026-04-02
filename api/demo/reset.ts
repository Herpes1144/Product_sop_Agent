import { respondWithPath } from "../_shared.js";

export default async function handler(
  request: { method?: string; body?: unknown },
  response: { status: (code: number) => { json: (payload: unknown) => void } }
) {
  await respondWithPath(request, response, "/api/demo/reset");
}
