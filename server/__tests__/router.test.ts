import { beforeEach, describe, expect, it } from "vitest";
import { handleApiRequest } from "../http/router.js";
import { resetRuntimeState } from "../runtime-state.js";

describe("runtime api router", () => {
  beforeEach(() => {
    resetRuntimeState();
  });

  it("serves bootstrap snapshot for demo validation", async () => {
    const result = await handleApiRequest("GET", "/api/bootstrap", {});
    const payload = result.payload as {
      state: { complaints: unknown[]; customers: unknown[] };
      workbenchTickets: unknown[];
    };

    expect(result.statusCode).toBe(200);
    expect(payload.state.customers.length).toBeGreaterThan(0);
    expect(payload.state.complaints.length).toBeGreaterThan(0);
    expect(payload.workbenchTickets.length).toBe(payload.state.complaints.length);
  });

  it("creates complaints through /api/complaints and resets them through /api/demo/reset", async () => {
    const created = await handleApiRequest("POST", "/api/complaints", {
      customerId: "customer-1",
      orderId: "order-new-1",
      issueType: "外观破损",
      issueDescription: "联调验证：锅身边缘有裂痕。",
      supplementalDescription: "想先确认是否继续处理。",
      attachments: []
    });

    expect(created.statusCode).toBe(201);

    const afterCreate = await handleApiRequest("GET", "/api/complaints", {});
    const complaintList = afterCreate.payload as { complaints: Array<{ issueDescription: string }> };

    expect(
      complaintList.complaints.some(
        (complaint) => complaint.issueDescription === "联调验证：锅身边缘有裂痕。"
      )
    ).toBe(true);

    const reset = await handleApiRequest("POST", "/api/demo/reset", {});
    const resetPayload = reset.payload as { state: { complaints: Array<{ issueDescription: string }> } };

    expect(reset.statusCode).toBe(200);
    expect(
      resetPayload.state.complaints.some(
        (complaint) => complaint.issueDescription === "联调验证：锅身边缘有裂痕。"
      )
    ).toBe(false);
  });
});
