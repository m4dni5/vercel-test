"use client";

import { useState } from "react";

export default function Home() {
  const [msg, setMsg] = useState("drop all tables");
  const [out, setOut] = useState("");
  const [runId, setRunId] = useState("");

  async function send() {
    setOut(""); setRunId("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: msg }] }),
    });
    setRunId(res.headers.get("x-workflow-run-id") ?? "(none)");
    setOut(await res.text());
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <h1>vercel-test — gated DB agent</h1>
      <p>
        Ask the agent to perform a destructive database action. It is gated
        behind a human-approval webhook. Note the <code>x-workflow-run-id</code>{" "}
        response header.
      </p>
      <input
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />
      <button onClick={send} style={{ padding: "8px 16px" }}>
        Send
      </button>
      <p>
        <strong>x-workflow-run-id:</strong> <code>{runId}</code>
      </p>
      <pre style={{ background: "#f4f4f4", padding: 12, whiteSpace: "pre-wrap" }}>
        {out}
      </pre>
    </main>
  );
}
