# vercel-test — gated DB agent (HITL approval bypass PoC)

A minimal, self-contained Next.js app demonstrating a durable chat agent that
gates a **destructive database action** ("drop all tables") behind a
human-in-the-loop approval webhook.

**Purpose:** a production-equivalent deployment for a bug-bounty finding: the
approval webhook token is deterministic given the run ID, and the `approvers`
check trusts a client-supplied `user.id` from the (unauthenticated) webhook
body. An attacker who can observe a run ID can forge an approval as an
authorized user and force a consequential action to execute.

## Architecture

- `workflows/chatFlow.ts` — durable workflow: if the user asks for a
  destructive DB action, it suspends on `createWebhook()` (the approval gate)
  and only runs `dropAllTables()` if the decision's `user.id` is in
  `APPROVERS`.
- `app/api/chat/route.ts` — chat endpoint. `start()`s the workflow and returns
  the run's ID in the **`x-workflow-run-id`** response header (the leak).
- `workflow/next` (`withWorkflow`) generates the `/.well-known/workflow/v1/webhook/[token]`
  route the forged approval POSTs to.

## Run / deploy

```bash
npm install
npm run dev        # local
npm run build && npm start
```

Deploy to Vercel by importing this repo (Hobby plan is sufficient).

## Scenario

A user (Mallory, not an approver) messages the agent: **"drop all tables."**
The agent streams that this requires approval and suspends on a webhook whose
token is a deterministic function of `runId:workflowName:deploymentId`. Mallory
reads the `x-workflow-run-id` header, recovers the token, and POSTs a forged
approval `{ user: { id: "U_ADMIN" } }`. The `approvers` check (which trusts the
body's `user.id`) passes, and the destructive action executes — an
authorization bypass with data-loss impact.

## Notes

- The gated action logs `DESTRUCTIVE_ACTION_EXECUTED` as an observable marker;
  a production app would run `DROP TABLE ...` against the database.
- `APPROVERS` is `["U_ADMIN"]`; the forged body impersonates that user.
