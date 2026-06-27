#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const dryRun = process.argv.includes("--dry-run");

const commands = [
  ["npm", ["run", "build:agent"]],
  [
    "tauri",
    [
      "build",
      "--config",
      isWindows ? "src-tauri/tauri.bundle.windows.conf.json" : "src-tauri/tauri.posix.conf.json",
    ],
  ],
];

if (dryRun) {
  for (const [cmd, args] of commands) {
    process.stdout.write(`${cmd} ${args.join(" ")}\n`);
  }
  process.exit(0);
}

for (const [cmd, args] of commands) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: isWindows,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
