import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // `@node-rs/xxhash` is used by the workflow runtime for deterministic hashing.
  serverExternalPackages: ["@node-rs/xxhash"],
};

export default withWorkflow(nextConfig);
