import { joinCatchAllPath, respondWithPath } from "../_shared.js";

export default async function handler(
  request: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | string[] | undefined>;
  },
  response: { status: (code: number) => { json: (payload: unknown) => void } }
) {
  await respondWithPath(
    request,
    response,
    joinCatchAllPath("/api/complaints", request.query?.route)
  );
}
