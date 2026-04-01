import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { mockTickets } from "../src/mock/tickets";
import type {
  ComplaintPathTag,
  ComplaintType,
  CustomerProfile,
  OrderRecord,
  ProductRecord
} from "../src/types/sandbox";
import type { NextActionType } from "../src/types/workbench";

const localEnvPath = resolve(process.cwd(), ".env.local");
const defaultEnvPath = resolve(process.cwd(), ".env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath, override: true });
} else if (existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: true });
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function buildTicketPathTag(status: string, nextActions: NextActionType[]): ComplaintPathTag {
  if (status === "waiting_material") return "补材料路径";
  if (status === "waiting_escalation") return "升级路径";
  if (status === "resolved") return "已处理完成";
  if (nextActions.includes("continue_refund")) return "退款路径";
  if (nextActions.includes("continue_return_refund")) return "退货退款路径";
  if (nextActions.includes("continue_exchange")) return "换货路径";
  if (nextActions.includes("continue_resend")) return "补发路径";
  return "待初判";
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const customers = await readJsonFile<CustomerProfile[]>(resolve(process.cwd(), "data/customers.json"));
  const products = await readJsonFile<ProductRecord[]>(resolve(process.cwd(), "data/products.json"));
  const orders = await readJsonFile<OrderRecord[]>(resolve(process.cwd(), "data/orders.json"));

  await supabase.from("analysis_snapshots").delete().neq("id", "");
  await supabase.from("event_logs").delete().neq("id", "");
  await supabase.from("attachments").delete().neq("id", "");
  await supabase.from("processing_records").delete().neq("id", "");
  await supabase.from("messages").delete().neq("id", "");
  await supabase.from("complaints").delete().neq("id", "");
  await supabase.from("orders").delete().neq("id", "");
  await supabase.from("products").delete().neq("id", "");
  await supabase.from("customers").delete().neq("id", "");

  await supabase.from("customers").insert(customers);
  await supabase.from("products").insert(
    products.map((item) => ({
      id: item.id,
      name: item.name,
      model: item.model,
      specification: item.specification,
      category: item.category,
      is_high_risk: item.isHighRisk
    }))
  );
  await supabase.from("orders").insert(
    orders.map((item) => ({
      id: item.id,
      order_id: item.orderId,
      customer_id: item.customerId,
      product_id: item.productId,
      order_status: item.orderStatus,
      product_info: item.productInfo
    }))
  );

  for (const [index, ticket] of mockTickets.entries()) {
    const complaintId = ticket.id;
    const customerId = index < 2 ? "customer-2" : "customer-3";
    const orderRefId = `seed-order-${index + 1}`;

    await supabase.from("complaints").insert({
      id: complaintId,
      customer_id: customerId,
      order_ref_id: orderRefId,
      order_id: ticket.order_id,
      ticket_no: ticket.ticketNo,
      created_at: ticket.createdAt,
      priority: ticket.priority,
      complaint_type: (ticket.problem_type === "待 AI 分析"
        ? "功能异常 / 无法使用"
        : ticket.problem_type) as ComplaintType,
      complaint_text: ticket.complaint_text,
      status: ticket.status,
      path_tag: buildTicketPathTag(
        ticket.status,
        ticket.next_action.map((item) => item.type)
      ),
      problem_type: ticket.problem_type,
      ai_question_summary: ticket.ai_question_summary,
      sop_judgement: ticket.sop_judgement,
      next_actions: ticket.next_action.map((item) => item.type),
      recording_summary: ticket.recording_summary,
      order_status: ticket.order_status,
      product_info: ticket.product_info,
      ai_suggested_status: ticket.aiSuggestedStatus ?? null,
      reanalyze_available: ticket.reanalyze_available ?? true,
      reanalyze_pending: false,
      analysis_snapshot_id: null,
      primary_action: ticket.primary_action ?? ticket.next_action[0]?.type ?? null,
      analysis_used_fallback: ticket.analysis_used_fallback ?? false,
      analysis_fallback_reason: ticket.analysis_fallback_reason ?? null,
      manual_guidance: ticket.manual_guidance ?? null,
      customer_intent_summary: ticket.customer_intent_summary ?? null,
      analyzed_attachment_count: ticket.analyzed_attachment_count ?? 0
    });

    if (ticket.chat_history.length > 0) {
      await supabase.from("messages").insert(
        ticket.chat_history.map((message, messageIndex) => ({
          id: message.id,
          complaint_id: complaintId,
          role: message.role,
          text: message.text,
          time_label: message.time,
          created_at: `2026-03-28T0${Math.min(messageIndex + 8, 9)}:00:00.000Z`
        }))
      );
    }

    if (ticket.processing_record.length > 0) {
      await supabase.from("processing_records").insert(
        ticket.processing_record.map((record, recordIndex) => ({
          id: record.id,
          complaint_id: complaintId,
          actor: record.actor,
          action: record.action,
          note: record.note,
          time_label: record.time,
          resulting_status: record.resultingStatus,
          created_at: `2026-03-28T1${Math.min(recordIndex, 9)}:00:00.000Z`
        }))
      );
    }

    await supabase.from("event_logs").insert({
      id: createId("event"),
      type: "complaint_created",
      complaint_id: complaintId,
      created_at: new Date().toISOString(),
      note: "已导入演示种子投诉。"
    });
  }

  console.log("Supabase seed completed.");
}

void main();
