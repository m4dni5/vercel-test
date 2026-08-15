import { start } from "workflow/api";
import { chatFlow } from "@/workflows/chatFlow";

/**
 * Web chat endpoint. Starts a durable workflow run and returns the run's ID
 * to the client in the `x-workflow-run-id` response header.
 *
 * A plain Response is used so the header is flushed to the client immediately,
 * before the workflow (which may suspend awaiting approval) produces output.
 */
export async function POST(req: Request) {
  const { messages }: { messages: { role: string; content: string }[] } =
    await req.json();

  const run = await start(chatFlow, [messages]);
  console.log("START_RETURNED runId=" + run.runId);

  return new Response(run.readable as unknown as BodyInit, {
    headers: {
      "x-workflow-run-id": run.runId,
      "content-type": "text/plain",
    },
  });
}
