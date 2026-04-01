import { createMockBackendService, type CreateMockBackendServiceOptions } from "./service";
import { createSupabaseBackendService, isSupabaseConfigured } from "./supabase-service";

export function createConfiguredBackendService(
  options: CreateMockBackendServiceOptions = {}
) {
  if (isSupabaseConfigured()) {
    return createSupabaseBackendService(options);
  }

  return createMockBackendService(options);
}
