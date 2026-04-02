import type { ActionItem, ComplaintTicket, NextActionType } from "../types/workbench";
import type {
  AttachmentAsset,
  ComplaintCase,
  ComplaintType,
  CreateComplaintInput,
  SandboxState
} from "../types/sandbox";
import type { ReplySuggestionResult } from "../types/ai";

export interface BootstrapResponse {
  snapshot: SandboxState;
  actionCatalog: ActionItem[];
}

export interface MutationResponse {
  complaint: ComplaintCase;
  snapshot: SandboxState;
  ticket: ComplaintTicket;
}

interface UploadableFile {
  name: string;
  mimeType: string;
  dataUrl: string;
}

async function requestJson<TResponse>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<TResponse> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parsing failures and keep the status message.
    }

    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}

export function requestBootstrap(): Promise<BootstrapResponse> {
  return requestJson<BootstrapResponse>("/api/bootstrap", {
    method: "GET"
  });
}

export function requestDemoReset(): Promise<BootstrapResponse> {
  return requestJson<BootstrapResponse>("/api/demo/reset", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function createComplaintRecord(
  input: Omit<CreateComplaintInput, "attachments"> & { complaintType: ComplaintType }
): Promise<MutationResponse> {
  return requestJson<MutationResponse>("/api/complaints", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function appendCustomerMessageRecord(
  complaintId: string,
  text: string
): Promise<MutationResponse> {
  return requestJson<MutationResponse>(`/api/complaints/${complaintId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

export function appendCustomerAttachmentsRecord(
  complaintId: string,
  files: UploadableFile[]
): Promise<MutationResponse> {
  return requestJson<MutationResponse>(`/api/complaints/${complaintId}/attachments`, {
    method: "POST",
    body: JSON.stringify({ files })
  });
}

export function requestComplaintReanalysis(
  complaintId: string
): Promise<MutationResponse> {
  return requestJson<MutationResponse>(`/api/complaints/${complaintId}/reanalysis-request`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function requestComplaintAnalysis(
  complaintId: string
): Promise<MutationResponse> {
  return requestJson<MutationResponse>(`/api/complaints/${complaintId}/analyze`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function requestComplaintReplyDraft(
  complaintId: string,
  actionType: NextActionType,
  fallbackText?: string
): Promise<ReplySuggestionResult> {
  return requestJson<ReplySuggestionResult>(`/api/complaints/${complaintId}/reply-draft`, {
    method: "POST",
    body: JSON.stringify({ actionType, fallbackText })
  });
}

export function applyComplaintAction(
  complaintId: string,
  actionType: NextActionType
): Promise<MutationResponse> {
  return requestJson<MutationResponse>(`/api/complaints/${complaintId}/actions`, {
    method: "POST",
    body: JSON.stringify({ actionType })
  });
}

export function appendOperatorMessageRecord(
  complaintId: string,
  text: string
): Promise<MutationResponse> {
  return requestJson<MutationResponse>(`/api/complaints/${complaintId}/operator-messages`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

export type { UploadableFile, AttachmentAsset };
