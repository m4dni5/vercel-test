import { createWebhook, getWritable } from "workflow";
import { DurableAgent } from "@workflow/ai/agent";
import { mockTextModel } from "@workflow/ai/test";

/**
 * The set of humans allowed to approve consequential actions. The chat SDK's
 * own guide validates exactly this field from the (unauthenticated) webhook
 * body. The vulnerability: `payload.user.id` is attacker-controlled.
 */
const APPROVERS = new Set(["U_ADMIN"]);

type Msg = { role: string; content: string };

/**
 * Durable chat agent. When asked to perform a consequential database action
 * ("drop all tables"), it first STREAMS a notice (which flushes the response
 * headers — including `x-workflow-run-id` — to the client immediately), then
 * suspends on a `createWebhook()` approval gate, and only executes the
 * destructive step if the decision is approved by a member of APPROVERS.
 */
export async function chatFlow(messages: Msg[]) {
  "use workflow";

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content ?? "";
  const destructive = /\b(drop|wipe|truncate|delete all)\b/i.test(text);

  // Stream an assistant message FIRST so the response starts (and the
  // x-workflow-run-id header is flushed) before the workflow parks on approval.
  const agent = new DurableAgent({
    model: mockTextModel(
      destructive
        ? "This will DROP ALL TABLES. Approval required."
        : "Ask me to do something database-related, e.g. \"drop all tables\"."
    ),
  });
  await agent.stream({
    messages: messages as never,
    writable: getWritable(),
  });

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

  // Stream a second message confirming the destructive action.
  const agent2 = new DurableAgent({
    model: mockTextModel(`DROPPED ALL TABLES — approved by ${approverId}`),
  });
  await agent2.stream({ messages: messages as never, writable: getWritable() });
}

/** The consequential destructive action, executed only after approval. */
async function dropAllTables() {
  "use step";
  // In production this runs `DROP TABLE ...` against the database. For the
  // PoC it emits an observable, logged side effect so the forged-approval
  // impact is verifiable.
  console.log("DESTRUCTIVE_ACTION_EXECUTED: DROP ALL TABLES");
}
