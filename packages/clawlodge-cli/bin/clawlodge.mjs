#!/usr/bin/env node

import { runCli } from "../lib/core.mjs";

runCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
