import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AiAnalysisResult } from "../types/ai";
import type { AttachmentAsset, ComplaintCase, CreateComplaintInput, SandboxState } from "../types/sandbox";
import {
  appendCustomerAttachments,
  appendCustomerMessage,
  appendOperatorMessage,
  applyAiAnalysisToComplaint,
  clearSandboxState,
  createComplaintFromOrder,
  createSandboxState,
  getComplaintByCustomer,
  getComplaintsByCustomer,
  getPersistedSandboxState,
  markComplaintReanalysisRequested,
  markReplyDraftGenerated,
  persistSandboxState,
  syncTicketFromComplaintWithOrder,
  updateComplaintStatus
} from "./sandbox-store";

interface SandboxContextValue {
  state: SandboxState;
  workbenchTickets: ReturnType<typeof syncTicketFromComplaintWithOrder>[];
  activeComplaint: ComplaintCase | null;
  customerComplaints: ComplaintCase[];
  activeCustomerComplaint: ComplaintCase | null;
  setActiveComplaintId: (complaintId: string) => void;
  setActiveCustomerId: (customerId: string) => void;
  createComplaint: (input: CreateComplaintInput) => ComplaintCase | null;
  addCustomerMessage: (complaintId: string, text: string) => void;
  addCustomerAttachments: (complaintId: string, attachments: AttachmentAsset[]) => void;
  addOperatorMessage: (complaintId: string, text: string) => void;
  updateStatus: (
    complaintId: string,
    status: ComplaintCase["status"],
    action: string,
    note: string
  ) => void;
  applyAnalysis: (complaintId: string, analysis: AiAnalysisResult) => void;
  requestReanalysis: (complaintId: string) => void;
  noteReplyDraftGenerated: (complaintId: string) => void;
  resetSandbox: () => void;
}

const SandboxContext = createContext<SandboxContextValue | null>(null);

export function SandboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SandboxState>(() => {
    return getPersistedSandboxState() ?? createSandboxState();
  });

  useEffect(() => {
    persistSandboxState(state);
  }, [state]);

  const value = useMemo<SandboxContextValue>(() => {
    const workbenchTickets = state.complaints.map((complaint) =>
      syncTicketFromComplaintWithOrder(state, complaint)
    );
    const activeComplaint =
      state.complaints.find((complaint) => complaint.id === state.activeComplaintId) ??
      state.complaints[0] ??
      null;
    const customerComplaints = getComplaintsByCustomer(state, state.activeCustomerId);
    const activeCustomerComplaint =
      customerComplaints.find((complaint) => complaint.id === state.activeComplaintId) ??
      customerComplaints[0] ??
      null;

    return {
      state,
      workbenchTickets,
      activeComplaint,
      customerComplaints,
      activeCustomerComplaint,
      setActiveComplaintId: (complaintId) =>
        setState((current) => ({
          ...current,
          activeComplaintId: complaintId
        })),
      setActiveCustomerId: (customerId) =>
        setState((current) => ({
          ...current,
          activeCustomerId: customerId,
          activeComplaintId:
            getComplaintByCustomer(current, customerId)?.id ?? null
        })),
      createComplaint: (input) => {
        let created: ComplaintCase | null = null;
        setState((current) => {
          const nextState = createComplaintFromOrder(current, input);
          created = nextState.complaints[0] ?? null;
          return nextState;
        });
        return created;
      },
      addCustomerMessage: (complaintId, text) =>
        setState((current) => appendCustomerMessage(current, complaintId, text)),
      addCustomerAttachments: (complaintId, attachments) =>
        setState((current) => appendCustomerAttachments(current, complaintId, attachments)),
      addOperatorMessage: (complaintId, text) =>
        setState((current) => appendOperatorMessage(current, complaintId, text)),
      updateStatus: (complaintId, status, action, note) =>
        setState((current) =>
          updateComplaintStatus(current, complaintId, status, action, note)
        ),
      applyAnalysis: (complaintId, analysis) =>
        setState((current) => applyAiAnalysisToComplaint(current, complaintId, analysis)),
      requestReanalysis: (complaintId) =>
        setState((current) => markComplaintReanalysisRequested(current, complaintId)),
      noteReplyDraftGenerated: (complaintId) =>
        setState((current) => markReplyDraftGenerated(current, complaintId)),
      resetSandbox: () => {
        clearSandboxState();
        setState(createSandboxState());
      }
    };
  }, [state]);

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}

export function useSandbox() {
  const value = useContext(SandboxContext);

  if (!value) {
    throw new Error("useSandbox must be used within SandboxProvider");
  }

  return value;
}
