import { createWebhook } from "workflow";

/**
 * The set of humans allowed to approve consequential actions. The chat SDK's
 * own guide validates exactly this field from the (unauthenticated) webhook
 * body. The vulnerability: `payload.user.id` is attacker-controlled.
 */
const APPROVERS = new Set(["U_ADMIN"]);

type Msg = { role: string; content: string };

/**
 * Durable chat agent. When asked to perform a consequential database action
 * ("drop all tables"), it suspends on a `createWebhook()` approval gate and
 * only executes the destructive step if the decision is approved by a member
 * of APPROVERS.
 */
export async function chatFlow(messages: Msg[]) {
  "use workflow";

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content ?? "";

  if (!/\b(drop|wipe|truncate|delete all)\b/i.test(text)) {
    return "Ask me to do something database-related, e.g. \"drop all tables\".";
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
  return `DROPPED ALL TABLES — approved by ${approverId}`;
}

/** The consequential destructive action, executed only after approval. */
async function dropAllTables() {
  "use step";
  // In production this runs `DROP TABLE ...` against the database. For the
  // PoC it emits an observable, logged side effect so the forged-approval
  // impact is verifiable.
  console.log("DESTRUCTIVE_ACTION_EXECUTED: DROP ALL TABLES");
}
