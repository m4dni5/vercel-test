import { createWebhook, getWritable } from "workflow";

/**
 * The set of users allowed to approve the gated action.
 */
const APPROVERS = new Set(["U_ADMIN"]);

type Msg = { role: string; content: string };

/**
 * Durable chat workflow. When asked to perform a consequential database action
 * ("drop all tables"), it writes a notice to the response, then suspends on an
 * approval webhook, and only executes the destructive step if the decision's
 * `user.id` is in APPROVERS.
 */
export async function chatFlow(messages: Msg[]) {
  "use workflow";

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content ?? "";
  const destructive = /\b(drop|wipe|truncate|delete all)\b/i.test(text);

  // Flush a notice (and the response headers) before suspending on approval.
  await writeNotice(
    destructive
      ? "This will DROP ALL TABLES. Approval required.\n"
      : "Ask me to do something database-related, e.g. \"drop all tables\".\n"
  );

  if (!destructive) {
    return;
  }

  // Consequential action -> suspend behind a human-approval webhook.
  using webhook = createWebhook();
  console.log("APPROVAL_WEBHOOK_URL=" + webhook.url);

  // Wait for the approval decision posted to the webhook.
  const request = await webhook;
  const payload = await request.json();

  const approverId = payload?.user?.id;
  if (!APPROVERS.has(approverId)) {
    return `Denied: ${approverId ?? "(no user)"} is not an authorized approver.`;
  }

  await dropAllTables();
}

/** Write a notice to the run's response stream. */
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
  // In production this would run `DROP TABLE ...` against a database. For this
  // demo it emits a logged marker so the gated action is observable.
  console.log("DESTRUCTIVE_ACTION_EXECUTED: DROP ALL TABLES");
}
