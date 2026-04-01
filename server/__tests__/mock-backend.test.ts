/**
 * @vitest-environment node
 */

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createMockBackendService } from "../data/service.js";

const cleanupTargets: string[] = [];

async function createService() {
  const rootDir = await mkdtemp(join(tmpdir(), "quality-complaint-backend-"));
  cleanupTargets.push(rootDir);

  return createMockBackendService({
    rootDir,
    nowLabel: () => "刚刚",
    nowStamp: () => "2026-03-31 21:00:00"
  });
}

afterEach(async () => {
  await Promise.all(
    cleanupTargets.splice(0).map((target) => rm(target, { recursive: true, force: true }))
  );
});

describe("mock backend service", () => {
  it("creates complaints in the server datastore and can reload them from disk", async () => {
    const service = await createService();

    const created = await service.createComplaint({
      customerId: "customer-1",
      orderId: "order-new-1",
      complaintType: "明显破损 / 瑕疵",
      complaintText: "刚收到电烤盘，外壳边角有磕碰。"
    });

    expect(created.complaint.ticketNo).toBe("QG-20260331-001");
    expect(created.complaint.complaintType).toBe("明显破损 / 瑕疵");
    expect(created.complaint.pathTag).toBe("待初判");
    expect(created.snapshot.complaints[0]?.id).toBe(created.complaint.id);

    const reloaded = await createMockBackendService({
      rootDir: service.rootDir,
      nowLabel: () => "刚刚",
      nowStamp: () => "2026-03-31 21:05:00"
    }).getSnapshot();

    expect(reloaded.complaints.some((complaint) => complaint.id === created.complaint.id)).toBe(
      true
    );
  });

  it("stores uploaded attachments on disk and marks the complaint as waiting for reanalysis", async () => {
    const service = await createService();
    const created = await service.createComplaint({
      customerId: "customer-1",
      orderId: "order-new-1",
      complaintType: "明显破损 / 瑕疵",
      complaintText: "锅身有裂痕。"
    });

    const upload = await service.addAttachments(created.complaint.id, [
      {
        name: "damage-photo.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,ZmFrZQ=="
      }
    ]);

    expect(upload.complaint.attachments).toHaveLength(1);
    expect(upload.complaint.reanalyzePending).toBe(true);
    expect(upload.complaint.reanalyzeAvailable).toBe(true);

    const stored = upload.complaint.attachments[0];
    expect(stored.previewUrl.startsWith("/uploads/")).toBe(true);
    expect(stored.storagePath).toContain("uploads");

    const fileInfo = await stat(stored.storagePath);
    expect(fileInfo.isFile()).toBe(true);
    expect((await readFile(stored.storagePath)).length).toBeGreaterThan(0);
  });

  it("applies operator actions as backend events and updates status, path tag, and processing records", async () => {
    const service = await createService();
    const created = await service.createComplaint({
      customerId: "customer-1",
      orderId: "order-new-1",
      complaintType: "功能异常 / 无法使用",
      complaintText: "刚收到就无法加热。"
    });

    const updated = await service.applyAction(created.complaint.id, {
      actionType: "request_photo"
    });

    expect(updated.complaint.status).toBe("waiting_material");
    expect(updated.complaint.pathTag).toBe("补材料路径");
    expect(updated.complaint.processingRecords[0]?.action).toBe("补照片");
    expect(updated.snapshot.eventLogs[0]?.type).toBe("operator_action_applied");
  });
});
