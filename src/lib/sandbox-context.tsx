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
  requestDemoReset,
  requestBootstrap,
  requestComplaintAnalysis,
  requestComplaintReanalysis
} from "./backend-client";
import { syncTicketFromComplaintWithOrder } from "./sandbox-store";

const UI_STATE_KEY = "quality-complaint-demo-ui-state";

interface PersistedUiState {
  activeCustomerId: string;
  activeComplaintId: string | null;
}

function readPersistedUiState(): PersistedUiState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(UI_STATE_KEY);
    return raw ? (JSON.parse(raw) as PersistedUiState) : null;
  } catch {
    return null;
  }
}

function writePersistedUiState(nextState: PersistedUiState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(UI_STATE_KEY, JSON.stringify(nextState));
}

function clearPersistedUiState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(UI_STATE_KEY);
}

function resolveActiveCustomerId(
  snapshot: SandboxState,
  currentValue: string,
  persistedValue: string
): string {
  const candidates = [
    currentValue,
    persistedValue,
    snapshot.activeCustomerId,
    snapshot.customers[0]?.id ?? ""
  ];

  for (const candidate of candidates) {
    if (candidate && snapshot.customers.some((customer) => customer.id === candidate)) {
      return candidate;
    }
  }

  return "";
}

function resolveActiveComplaintId(
  snapshot: SandboxState,
  currentValue: string | null,
  persistedValue: string | null
): string | null {
  const candidates = [
    currentValue,
    persistedValue,
    snapshot.activeComplaintId,
    snapshot.complaints[0]?.id ?? null
  ];

  for (const candidate of candidates) {
    if (candidate && snapshot.complaints.some((complaint) => complaint.id === candidate)) {
      return candidate;
    }
  }

  return null;
}

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
    const persistedUiState = readPersistedUiState();
    const nextActiveCustomerId = resolveActiveCustomerId(
      payload.snapshot,
      activeCustomerId,
      persistedUiState?.activeCustomerId ?? ""
    );
    const nextActiveComplaintId = resolveActiveComplaintId(
      payload.snapshot,
      activeComplaintId,
      persistedUiState?.activeComplaintId ?? null
    );
    setState(payload.snapshot);
    setActionCatalog(payload.actionCatalog);
    setActiveCustomerIdState(nextActiveCustomerId);
    setActiveComplaintIdState(nextActiveComplaintId);
  }

  useEffect(() => {
    let cancelled = false;
    setIsBootstrapping(true);

    void requestBootstrap()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const persistedUiState = readPersistedUiState();
        setState(payload.snapshot);
        setActionCatalog(payload.actionCatalog);
        setActiveCustomerIdState(
          resolveActiveCustomerId(
            payload.snapshot,
            "",
            persistedUiState?.activeCustomerId ?? ""
          )
        );
        setActiveComplaintIdState(
          resolveActiveComplaintId(
            payload.snapshot,
            null,
            persistedUiState?.activeComplaintId ?? null
          )
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

  useEffect(() => {
    writePersistedUiState({
      activeCustomerId,
      activeComplaintId
    });
  }, [activeComplaintId, activeCustomerId]);

  const value = useMemo<SandboxContextValue>(() => {
    const workbenchTickets = state.complaints.map((complaint) =>
      syncTicketFromComplaintWithOrder(state, complaint)
    );
    const activeComplaint =
      state.complaints.find((complaint) => complaint.id === activeComplaintId) ??
      state.complaints[0] ??
      null;
    const activeCustomerComplaint =
      (activeComplaint?.customerId === activeCustomerId ? activeComplaint : null) ??
      state.complaints.find((complaint) => complaint.customerId === activeCustomerId) ??
      null;

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
        setActiveCustomerIdState(result.complaint.customerId);
        setActiveComplaintIdState(result.complaint.id);
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
        setActiveCustomerIdState(result.complaint.customerId);
        setActiveComplaintIdState(result.complaint.id);
        setBackendError(null);
      },
      addOperatorMessage: async (complaintId, text) => {
        const result = await appendOperatorMessageRecord(complaintId, text);
        setState(result.snapshot);
        setActiveCustomerIdState(result.complaint.customerId);
        setActiveComplaintIdState(result.complaint.id);
        setBackendError(null);
      },
      applyAction: async (complaintId, actionType) => {
        const result = await applyComplaintAction(complaintId, actionType);
        setState(result.snapshot);
        setActiveCustomerIdState(result.complaint.customerId);
        setActiveComplaintIdState(result.complaint.id);
        setBackendError(null);
      },
      analyzeComplaint: async (complaintId) => {
        const result = await requestComplaintAnalysis(complaintId);
        setState(result.snapshot);
        setActiveCustomerIdState(result.complaint.customerId);
        setActiveComplaintIdState(result.complaint.id);
        setBackendError(null);
      },
      requestReanalysis: async (complaintId) => {
        const result = await requestComplaintReanalysis(complaintId);
        setState(result.snapshot);
        setActiveCustomerIdState(result.complaint.customerId);
        setActiveComplaintIdState(result.complaint.id);
        setBackendError(null);
      },
      resetSandbox: async () => {
        const payload = await requestDemoReset();
        clearPersistedUiState();
        setState(payload.snapshot);
        setActionCatalog(payload.actionCatalog);
        setActiveCustomerIdState(
          payload.snapshot.activeCustomerId || payload.snapshot.customers[0]?.id || ""
        );
        setActiveComplaintIdState(
          payload.snapshot.activeComplaintId || payload.snapshot.complaints[0]?.id || null
        );
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
