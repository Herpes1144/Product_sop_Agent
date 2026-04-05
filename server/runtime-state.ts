import type {
  AttachmentAsset,
  ComplaintCase,
  CreateComplaintInput,
  DraftAttachmentAsset,
  SandboxState,
  SandboxStoreSnapshot
} from "../src/types/sandbox.js";
import type { AiAnalysisResult } from "../src/types/ai.js";
import type { ComplaintTicket, TicketStatus } from "../src/types/workbench.js";
import {
  appendCustomerAttachments,
  appendCustomerMessage,
  appendOperatorMessage,
  applyAiAnalysisToComplaint,
  createComplaintFromOrder,
  createSandboxState,
  markComplaintReanalysisRequested,
  markReplyDraftGenerated,
  syncTicketFromComplaintWithOrder,
  updateComplaintStatus
} from "../src/lib/sandbox-store.js";

let runtimeState: SandboxState | null = null;

function ensureState(): SandboxState {
  if (!runtimeState) {
    runtimeState = createSandboxState();
  }

  return runtimeState;
}

function updateState(updater: (state: SandboxState) => SandboxState): SandboxState {
  const nextState = updater(ensureState());
  runtimeState = nextState;
  return nextState;
}

function findComplaint(state: SandboxState, complaintId: string): ComplaintCase | null {
  return state.complaints.find((complaint) => complaint.id === complaintId) ?? null;
}

function complaintToTicket(state: SandboxState, complaint: ComplaintCase): ComplaintTicket {
  return syncTicketFromComplaintWithOrder(state, complaint);
}

function toSnapshot(state: SandboxState): SandboxStoreSnapshot {
  return {
    state,
    workbenchTickets: state.complaints.map((complaint) =>
      complaintToTicket(state, complaint)
    )
  };
}

function normalizeDraftAttachment(
  complaintId: string,
  attachment: AttachmentAsset | DraftAttachmentAsset
): AttachmentAsset {
  if ("id" in attachment && "complaintId" in attachment) {
    return {
      ...attachment,
      complaintId
    };
  }

  return {
    id: `attachment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    complaintId,
    name: attachment.name,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    size: attachment.size,
    previewUrl: attachment.previewUrl,
    uploadedAt: attachment.uploadedAt
  };
}

export function getRuntimeSnapshot(): SandboxStoreSnapshot {
  return toSnapshot(ensureState());
}

export function resetRuntimeState(): SandboxStoreSnapshot {
  runtimeState = createSandboxState();
  return toSnapshot(runtimeState);
}

export function listRuntimeComplaints() {
  const snapshot = getRuntimeSnapshot();
  return {
    ...snapshot,
    complaints: snapshot.state.complaints
  };
}

export function getRuntimeComplaintDetail(complaintId: string) {
  const state = ensureState();
  const complaint = findComplaint(state, complaintId);

  if (!complaint) {
    return null;
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}

export function createRuntimeComplaint(input: CreateComplaintInput) {
  const state = updateState((current) => createComplaintFromOrder(current, input));
  const complaint = state.complaints[0] ?? null;

  if (!complaint) {
    throw new Error("Complaint creation failed.");
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}

export function addRuntimeCustomerMessage(complaintId: string, text: string) {
  const state = updateState((current) => appendCustomerMessage(current, complaintId, text));
  const complaint = findComplaint(state, complaintId);

  if (!complaint) {
    return null;
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}

export function addRuntimeOperatorMessage(complaintId: string, text: string) {
  const state = updateState((current) => appendOperatorMessage(current, complaintId, text));
  const complaint = findComplaint(state, complaintId);

  if (!complaint) {
    return null;
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}

export function addRuntimeAttachments(
  complaintId: string,
  attachments: Array<AttachmentAsset | DraftAttachmentAsset>
) {
  const normalizedAttachments = attachments.map((attachment) =>
    normalizeDraftAttachment(complaintId, attachment)
  );
  const state = updateState((current) =>
    appendCustomerAttachments(current, complaintId, normalizedAttachments)
  );
  const complaint = findComplaint(state, complaintId);

  if (!complaint) {
    return null;
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}

export function markRuntimeReanalysisRequested(complaintId: string) {
  const state = updateState((current) =>
    markComplaintReanalysisRequested(current, complaintId)
  );
  const complaint = findComplaint(state, complaintId);

  if (!complaint) {
    return null;
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}

export function applyRuntimeAnalysis(complaintId: string, analysis: AiAnalysisResult) {
  const state = updateState((current) =>
    applyAiAnalysisToComplaint(current, complaintId, analysis)
  );
  const complaint = findComplaint(state, complaintId);

  if (!complaint) {
    return null;
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}

export function noteRuntimeReplyDraftGenerated(complaintId: string) {
  const state = updateState((current) => markReplyDraftGenerated(current, complaintId));
  const complaint = findComplaint(state, complaintId);

  if (!complaint) {
    return null;
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}

export function updateRuntimeStatus(
  complaintId: string,
  status: TicketStatus,
  action: string,
  note: string
) {
  const state = updateState((current) =>
    updateComplaintStatus(current, complaintId, status, action, note)
  );
  const complaint = findComplaint(state, complaintId);

  if (!complaint) {
    return null;
  }

  return {
    complaint,
    ticket: complaintToTicket(state, complaint),
    snapshot: toSnapshot(state)
  };
}
