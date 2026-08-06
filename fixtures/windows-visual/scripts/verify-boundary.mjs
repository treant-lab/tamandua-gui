import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceBoundary = 'browser fixture — not native Tauri/WebView2 runtime';
const expectedFiles = Object.freeze([
  'index.html',
  'vite.config.ts',
  'src/main.tsx',
  'src/FixtureBoundary.tsx',
  'src/scenarios.ts',
  'src/fixture.css',
  'src/FixtureBoundary.test.tsx',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/build.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/src/main.rs',
  'scripts/verify-boundary.mjs',
]);

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolute)));
    else if (entry.isFile()) files.push(relative(fixtureRoot, absolute).split(sep).join('/'));
    else failures.push(`non-regular path denied: ${relative(fixtureRoot, absolute)}`);
  }
  return files;
}

const actualFiles = (await collectFiles(fixtureRoot)).sort();
const sortedExpected = [...expectedFiles].sort();
assert(JSON.stringify(actualFiles) === JSON.stringify(sortedExpected), 'fixture file set differs from exact 13-path allowlist');

const texts = new Map();
for (const path of expectedFiles) texts.set(path, await readFile(resolve(fixtureRoot, path), 'utf8'));

const config = JSON.parse(texts.get('src-tauri/tauri.conf.json'));
assert(JSON.stringify(config.tauri.allowlist) === '{"all":false}', 'Tauri allowlist must contain only all=false');
assert(config.tauri.updater?.active === false, 'updater must be inactive');
assert(!('endpoints' in config.tauri.updater), 'updater endpoints must be absent');
assert(!('systemTray' in config.tauri), 'system tray must be absent');
assert(Array.isArray(config.tauri.windows) && config.tauri.windows.length === 0, 'config windows must be empty; Rust owns the single fixture window');
assert(config.tauri.bundle?.active === false, 'installer bundling must be inactive');
assert(config.tauri.bundle?.externalBin?.length === 0, 'external binaries must be empty');
assert(config.tauri.bundle?.resources?.length === 0, 'external resources must be empty');
assert(config.build?.devPath === '../dist' && config.build?.distDir === '../dist', 'fixture must load only packaged relative assets');
assert(config.build?.beforeBuildCommand === '' && config.build?.beforeDevCommand === '', 'Tauri hooks must not run external commands');
assert(config.tauri.security?.csp?.includes("connect-src 'none'"), "CSP must contain connect-src 'none'");
assert(!/https?:|wss?:/i.test(JSON.stringify(config)), 'Tauri config must not contain external URLs');

const cargo = texts.get('src-tauri/Cargo.toml');
assert(/name = "tamandua-gui-visual-fixture"/.test(cargo), 'fixture crate name missing');
assert(/default = \["visual-fixture"\]/.test(cargo), 'visual-fixture must be the only default feature');
assert(/production = \[\]/.test(cargo), 'production conflict sentinel feature missing');
for (const disallowedDependency of ['reqwest', 'tokio', 'windows =', 'serde', 'rusqlite', 'sysinfo']) {
  assert(!cargo.includes(disallowedDependency), `disallowed fixture dependency: ${disallowedDependency}`);
}

const rust = texts.get('src-tauri/src/main.rs');
for (const required of [
  'compile_error!',
  '--visual-scenario',
  'dashboard-offline',
  'dashboard-error',
  'WindowUrl::App',
  'VISUAL FIXTURE · NO ENDPOINT ACTIONS',
]) assert(rust.includes(required), `Rust boundary marker missing: ${required}`);

const rustDenials = [
  'AppState',
  'invoke_handler',
  'generate_handler',
  'tauri::command',
  'system_tray',
  'Command::new',
  'std::net',
  'TcpStream',
  'UdpSocket',
  'NamedPipe',
  'Registry',
  'ServiceManager',
  'start_ipc_client',
];
for (const denied of rustDenials) assert(!rust.includes(denied), `Rust boundary contains denied token: ${denied}`);

const frontendSubjects = [
  'index.html',
  'src/main.tsx',
  'src/FixtureBoundary.tsx',
  'src/scenarios.ts',
  'src/fixture.css',
  'src/FixtureBoundary.test.tsx',
];
const frontend = frontendSubjects.map((path) => texts.get(path)).join('\n');
const forbiddenFrontendTokens = [
  '@tauri-apps/api',
  '../src/',
  '../../src/',
  'window.__TAURI__',
  'invoke(',
  'listen(',
  'emit(',
  'WebSocket',
  'XMLHttpRequest',
  'EventSource',
  'sendBeacon',
  'fetch(',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  '<form',
];
for (const denied of forbiddenFrontendTokens) assert(!frontend.includes(denied), `frontend boundary contains denied token: ${denied}`);
assert(!/https?:|wss?:/i.test(frontend), 'frontend must not contain external URLs');

const allowedBareImports = new Set([
  'react',
  'react-dom/client',
  '@testing-library/jest-dom/vitest',
  '@testing-library/react',
  'vitest',
]);
for (const path of frontendSubjects.filter((value) => /\.[cm]?[jt]sx?$/.test(value))) {
  const source = texts.get(path);
  const importSpecifiers = [
    ...source.matchAll(/(?:\bfrom\s+|\bimport\s+)["']([^"']+)["']/g),
  ].map((match) => match[1]);
  for (const specifier of importSpecifiers) {
    if (specifier.startsWith('.')) {
      const resolvedImport = resolve(dirname(resolve(fixtureRoot, path)), specifier);
      assert(
        resolvedImport === fixtureRoot || resolvedImport.startsWith(`${fixtureRoot}${sep}`),
        `relative import escapes fixture root: ${path} -> ${specifier}`,
      );
    } else {
      assert(allowedBareImports.has(specifier), `bare frontend import is not allowlisted: ${path} -> ${specifier}`);
    }
  }
}

const html = texts.get('index.html');
assert((html.match(/<script\b/g) ?? []).length === 1, 'index must contain exactly one script');
assert(html.includes('src="/src/main.tsx"'), 'index script must point only to local fixture entrypoint');

const scenarios = texts.get('src/scenarios.ts');
assert((scenarios.match(/code: 'fixture_denied'/g) ?? []).length === 4, 'all three mutation entries plus their type must use fixture_denied');
assert((scenarios.match(/decision: 'no_operation'/g) ?? []).length === 4, 'all three mutation entries plus their type must use no_operation');
assert(scenarios.includes("['dashboard-offline', 'dashboard-error'] as const"), 'scenario allowlist must be exact and bounded');
assert(scenarios.includes('Object.freeze'), 'scenario bundle must be immutable');

const bannerCount = frontendSubjects
  .map((path) => texts.get(path))
  .join('\n')
  .match(/VISUAL FIXTURE · NO ENDPOINT ACTIONS/g)?.length ?? 0;
assert(bannerCount >= 3, 'fixture banner must be explicit in host, render fallback, and test');
assert(
  texts.get('src/FixtureBoundary.tsx').includes(`<span>${evidenceBoundary}</span>`),
  'visible evidence boundary must explicitly identify browser fixture and deny native Tauri/WebView2 runtime evidence',
);
assert(
  texts.get('src/FixtureBoundary.test.tsx').includes(
    `screen.getByText('${evidenceBoundary}')`,
  ),
  'boundary test must pin the exact browser-only evidence wording',
);
assert(!/native\s+canary\s+only/i.test(frontend), 'ambiguous native canary wording must be absent');

const hashes = Object.fromEntries(
  expectedFiles.map((path) => [path, createHash('sha256').update(texts.get(path)).digest('hex')]),
);

if (failures.length > 0) {
  console.error(JSON.stringify({ status: 'fail', failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'pass',
    contract: 'GUI-FIXTURE-14',
    files: expectedFiles.length,
    scenarios: ['dashboard-offline', 'dashboard-error'],
    capabilities: 'closed',
    runtime_io: 'absent',
    hashes,
  }, null, 2));
}
