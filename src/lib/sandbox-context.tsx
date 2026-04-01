import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { ActionItem } from "../types/workbench";
import type {
  AttachmentAsset,
  ComplaintCase,
  CreateComplaintInput,
  SandboxState
} from "../types/sandbox";
import {
  appendCustomerAttachmentsRecord,
  appendCustomerMessageRecord,
  appendOperatorMessageRecord,
  applyComplaintAction,
  createComplaintRecord,
  requestBootstrap,
  requestComplaintAnalysis,
  requestComplaintReanalysis
} from "./backend-client";
import { syncTicketFromComplaintWithOrder } from "./sandbox-store";

interface SandboxContextValue {
  state: SandboxState;
  actionCatalog: ActionItem[];
  workbenchTickets: ReturnType<typeof syncTicketFromComplaintWithOrder>[];
  activeComplaint: ComplaintCase | null;
  activeCustomerComplaint: ComplaintCase | null;
  isBootstrapping: boolean;
  backendError: string | null;
  setActiveComplaintId: (complaintId: string) => void;
  setActiveCustomerId: (customerId: string) => void;
  createComplaint: (input: CreateComplaintInput) => Promise<ComplaintCase | null>;
  addCustomerMessage: (complaintId: string, text: string) => Promise<void>;
  addCustomerAttachments: (complaintId: string, attachments: AttachmentAsset[]) => Promise<void>;
  addOperatorMessage: (complaintId: string, text: string) => Promise<void>;
  applyAction: (complaintId: string, actionType: ActionItem["type"]) => Promise<void>;
  analyzeComplaint: (complaintId: string) => Promise<void>;
  requestReanalysis: (complaintId: string) => Promise<void>;
  resetSandbox: () => Promise<void>;
}

const emptyState: SandboxState = {
  customers: [],
  products: [],
  orders: [],
  complaints: [],
  eventLogs: [],
  analysisSnapshots: [],
  activeCustomerId: "",
  activeComplaintId: null
};

const SandboxContext = createContext<SandboxContextValue | null>(null);

export function SandboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SandboxState>(emptyState);
  const [actionCatalog, setActionCatalog] = useState<ActionItem[]>([]);
  const [activeCustomerId, setActiveCustomerIdState] = useState("");
  const [activeComplaintId, setActiveComplaintIdState] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  async function refreshBootstrap() {
    const payload = await requestBootstrap();
    setState(payload.snapshot);
    setActionCatalog(payload.actionCatalog);
    setActiveCustomerIdState((current) => current || payload.snapshot.activeCustomerId || payload.snapshot.customers[0]?.id || "");
    setActiveComplaintIdState((current) => {
      if (current && payload.snapshot.complaints.some((complaint) => complaint.id === current)) {
        return current;
      }

      return payload.snapshot.activeComplaintId || payload.snapshot.complaints[0]?.id || null;
    });
  }

  useEffect(() => {
    let cancelled = false;
    setIsBootstrapping(true);

    void requestBootstrap()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setState(payload.snapshot);
        setActionCatalog(payload.actionCatalog);
        setActiveCustomerIdState(
          payload.snapshot.activeCustomerId || payload.snapshot.customers[0]?.id || ""
        );
        setActiveComplaintIdState(
          payload.snapshot.activeComplaintId || payload.snapshot.complaints[0]?.id || null
        );
        setBackendError(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setBackendError(error instanceof Error ? error.message : "后端服务不可用。");
      })
      .finally(() => {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SandboxContextValue>(() => {
    const workbenchTickets = state.complaints.map((complaint) =>
      syncTicketFromComplaintWithOrder(state, complaint)
    );
    const activeComplaint =
      state.complaints.find((complaint) => complaint.id === activeComplaintId) ??
      state.complaints[0] ??
      null;
    const activeCustomerComplaint =
      state.complaints.find((complaint) => complaint.customerId === activeCustomerId) ?? null;

    return {
      state: {
        ...state,
        activeCustomerId,
        activeComplaintId
      },
      actionCatalog,
      workbenchTickets,
      activeComplaint,
      activeCustomerComplaint,
      isBootstrapping,
      backendError,
      setActiveComplaintId: setActiveComplaintIdState,
      setActiveCustomerId: setActiveCustomerIdState,
      createComplaint: async (input) => {
        const result = await createComplaintRecord({
          customerId: input.customerId,
          orderId: input.orderId,
          complaintType: input.complaintType,
          complaintText: input.complaintText
        });
        setState(result.snapshot);
        setActiveCustomerIdState(input.customerId);
        setActiveComplaintIdState(result.complaint.id);
        setBackendError(null);
        return result.complaint;
      },
      addCustomerMessage: async (complaintId, text) => {
        const result = await appendCustomerMessageRecord(complaintId, text);
        setState(result.snapshot);
        setBackendError(null);
      },
      addCustomerAttachments: async (complaintId, attachments) => {
        const result = await appendCustomerAttachmentsRecord(
          complaintId,
          attachments.map((attachment) => ({
            name: attachment.name,
            mimeType: attachment.mimeType,
            dataUrl: attachment.previewUrl
          }))
        );
        setState(result.snapshot);
        setBackendError(null);
      },
      addOperatorMessage: async (complaintId, text) => {
        const result = await appendOperatorMessageRecord(complaintId, text);
        setState(result.snapshot);
        setBackendError(null);
      },
      applyAction: async (complaintId, actionType) => {
        const result = await applyComplaintAction(complaintId, actionType);
        setState(result.snapshot);
        setBackendError(null);
      },
      analyzeComplaint: async (complaintId) => {
        const result = await requestComplaintAnalysis(complaintId);
        setState(result.snapshot);
        setBackendError(null);
      },
      requestReanalysis: async (complaintId) => {
        const result = await requestComplaintReanalysis(complaintId);
        setState(result.snapshot);
        setBackendError(null);
      },
      resetSandbox: async () => {
        await refreshBootstrap();
        setBackendError(null);
      }
    };
  }, [
    actionCatalog,
    activeComplaintId,
    activeCustomerId,
    backendError,
    isBootstrapping,
    state
  ]);

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}

export function useSandbox() {
  const value = useContext(SandboxContext);

  if (!value) {
    throw new Error("useSandbox must be used within SandboxProvider");
  }

  return value;
}
