import { createMockBackendService, type CreateMockBackendServiceOptions } from "./service.js";
import { createSupabaseBackendService, isSupabaseConfigured } from "./supabase-service.js";

export function createConfiguredBackendService(
  options: CreateMockBackendServiceOptions = {}
) {
  if (isSupabaseConfigured()) {
    return createSupabaseBackendService(options);
  }

  return createMockBackendService(options);
}
