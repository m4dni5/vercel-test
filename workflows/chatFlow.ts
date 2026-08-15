import { createWebhook, getWritable } from "workflow";

/**
 * The set of humans allowed to approve consequential actions. The chat SDK's
 * own guide validates exactly this field from the (unauthenticated) webhook
 * body. The vulnerability: `payload.user.id` is attacker-controlled.
 */
const APPROVERS = new Set(["U_ADMIN"]);

type Msg = { role: string; content: string };

/**
 * Durable workflow. When asked to perform a consequential database action
 * ("drop all tables"), it first writes a notice to the response stream — which
 * flushes the `x-workflow-run-id` header to the initiator immediately — then
 * suspends on a `createWebhook()` approval gate, and only executes the
 * destructive step if the decision is approved by a member of APPROVERS.
 *
 * The header-flush write happens inside a `"use step"` function: the workflow
 * sandbox forbids calling `WritableStream.getWriter()` directly in a workflow
 * function ("Not supported in workflow functions"), and using the @workflow/ai
 * DurableAgent to stream introduces a finalization `doStreamStep` that errors
 * on Vercel once the response has been flushed and the workflow resumed. A
 * plain step-side write flushes the header with neither problem.
 */
export async function chatFlow(messages: Msg[]) {
  "use workflow";

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content ?? "";
  const destructive = /\b(drop|wipe|truncate|delete all)\b/i.test(text);

  // Flush a notice (and the x-workflow-run-id header) before parking on approval.
  await writeNotice(
    destructive
      ? "This will DROP ALL TABLES. Approval required.\n"
      : "Ask me to do something database-related, e.g. \"drop all tables\".\n"
  );

  if (!destructive) {
    return;
  }

  // Consequential action -> gate behind a human-approval webhook.
  using webhook = createWebhook();
  // In a real app this URL is embedded in the approval card's button
  // callbackUrl. It is authenticated ONLY by its token.
  console.log("APPROVAL_WEBHOOK_URL=" + webhook.url);

  // Suspend until the webhook is POSTed (a human clicks, or an attacker forges).
  const request = await webhook;
  const payload = await request.json();

  const approverId = payload?.user?.id;
  if (!APPROVERS.has(approverId)) {
    return `Denied: ${approverId ?? "(no user)"} is not an authorized approver.`;
  }

  await dropAllTables();
}

/** Write a notice to the run's response stream (flushes the response/header). */
async function writeNotice(text: string) {
  "use step";
  const writable = getWritable();
  const writer = writable.getWriter();
  await writer.write(new TextEncoder().encode(text));
  writer.releaseLock();
}

/** The consequential destructive action, executed only after approval. */
async function dropAllTables() {
  "use step";
  // In production this runs `DROP TABLE ...` against the database. For the
  // PoC it emits an observable, logged side effect so the forged-approval
  // impact is verifiable.
  console.log("DESTRUCTIVE_ACTION_EXECUTED: DROP ALL TABLES");
}
