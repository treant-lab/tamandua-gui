#!/usr/bin/env node
/**
 * fetch-agent.mjs
 *
 * Standalone replacement for the old `build:agent` step that used to invoke
 * `cargo build --manifest-path ../tamandua_agent/...`. That cross-repo cargo
 * build couples the GUI mirror (treant-lab/tamandua-gui) to a sibling checkout
 * of the agent, which does not exist when the GUI is cloned on its own.
 *
 * Instead we fetch a prebuilt `tamandua-agent` binary and drop it into
 * `src-tauri/bin/`, where `tauri.conf.json` bundles it as a resource.
 *
 * Resolution precedence (first hit wins):
 *   1. TAMANDUA_AGENT_BINARY  - absolute path to a locally-built binary; copied
 *      verbatim. This is the escape hatch for monorepo/offline development
 *      (e.g. point it at ../tamandua_agent/target/release/tamandua-agent).
 *   2. GitHub release asset    - downloaded from TAMANDUA_AGENT_REPO
 *      (default treant-lab/tamandua-agent) at tag TAMANDUA_AGENT_VERSION
 *      (default "latest"). The asset whose name matches the current
 *      platform/arch is selected.
 *
 * Set TAMANDUA_AGENT_SKIP=1 to skip entirely when a binary is already present
 * (useful for fast iteration on the frontend).
 */

import { existsSync, mkdirSync, copyFileSync, createWriteStream, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_TAURI = resolve(__dirname, "..", "src-tauri");
const BIN_DIR = join(SRC_TAURI, "bin");

const isWindows = process.platform === "win32";
const BIN_NAME = isWindows ? "tamandua-agent.exe" : "tamandua-agent";
const DEST = join(BIN_DIR, BIN_NAME);

const REPO = process.env.TAMANDUA_AGENT_REPO || "treant-lab/tamandua-agent";
const VERSION = process.env.TAMANDUA_AGENT_VERSION || "latest";

function log(msg) {
  process.stdout.write(`[fetch-agent] ${msg}\n`);
}

function ensureBinDir() {
  if (!existsSync(BIN_DIR)) {
    mkdirSync(BIN_DIR, { recursive: true });
  }
}

/** Heuristic: pick the release asset that matches this host's platform/arch. */
function matchAsset(assets) {
  const arch = process.arch === "arm64" ? ["aarch64", "arm64"] : ["x86_64", "amd64", "x64"];
  const platformKeys = {
    win32: ["windows", "pc-windows", "win"],
    darwin: ["apple-darwin", "macos", "darwin"],
    linux: ["unknown-linux", "linux"],
  }[process.platform] || [];

  const scored = assets
    .map((a) => {
      const name = a.name.toLowerCase();
      const platOk = platformKeys.some((k) => name.includes(k));
      const archOk = arch.some((k) => name.includes(k));
      // Prefer statically-linked musl on Linux when available.
      const muslBonus = process.platform === "linux" && name.includes("musl") ? 1 : 0;
      return { asset: a, score: (platOk ? 2 : 0) + (archOk ? 1 : 0) + muslBonus };
    })
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0].asset : null;
}

async function ghJson(url) {
  const headers = { "User-Agent": "tamandua-fetch-agent", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${url}: ${await res.text()}`);
  }
  return res.json();
}

async function download(url, dest) {
  const headers = { "User-Agent": "tamandua-fetch-agent", Accept: "application/octet-stream" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status} for ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function main() {
  ensureBinDir();

  // 1. Local override (monorepo / offline).
  const localOverride = process.env.TAMANDUA_AGENT_BINARY;
  if (localOverride) {
    if (!existsSync(localOverride)) {
      throw new Error(`TAMANDUA_AGENT_BINARY does not exist: ${localOverride}`);
    }
    log(`Using local agent binary: ${localOverride}`);
    copyFileSync(localOverride, DEST);
    if (!isWindows) chmodSync(DEST, 0o755);
    log(`Copied to ${DEST}`);
    return;
  }

  // Skip if already present and explicitly allowed.
  if (process.env.TAMANDUA_AGENT_SKIP === "1" && existsSync(DEST)) {
    log(`Binary already present and TAMANDUA_AGENT_SKIP=1; skipping. (${DEST})`);
    return;
  }

  // 2. GitHub release asset.
  const apiBase = `https://api.github.com/repos/${REPO}/releases`;
  const relUrl = VERSION === "latest" ? `${apiBase}/latest` : `${apiBase}/tags/${VERSION}`;
  log(`Resolving agent release: repo=${REPO} version=${VERSION}`);
  const release = await ghJson(relUrl);

  const asset = matchAsset(release.assets || []);
  if (!asset) {
    const names = (release.assets || []).map((a) => a.name).join(", ") || "(none)";
    throw new Error(
      `No release asset matched platform=${process.platform} arch=${process.arch}.\n` +
        `Available assets: ${names}\n` +
        `Set TAMANDUA_AGENT_BINARY to a locally-built binary to bypass.`,
    );
  }

  log(`Downloading ${asset.name} (${asset.size} bytes) -> ${DEST}`);
  await download(asset.url, DEST);
  if (!isWindows) chmodSync(DEST, 0o755);
  log(`Agent binary ready at ${DEST}`);
}

main().catch((err) => {
  process.stderr.write(`[fetch-agent] ERROR: ${err.message}\n`);
  process.exit(1);
});
