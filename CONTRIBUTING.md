# Contributing to tamandua-gui

This component is part of the Tamandua EDR platform. For the canonical
contribution guide — code of conduct, contribution tracks, and community
norms — see the community repository:

  https://github.com/treant-lab/tamandua-community

Please also read this component's [README](./README.md) for details.

## Component build & test

```bash
npm install
npm run build:agent   # fetches a prebuilt agent binary (honors TAMANDUA_AGENT_VERSION)
npm run tauri:build:plan
npm run tauri:build   # selects the Windows Tauri resource override on win32
npm test
(cd src-tauri && cargo check)
```

## Before opening a PR

- `build:agent` fetches the agent release binary; set TAMANDUA_AGENT_BINARY to a local path for offline builds.
- `tauri:build:plan` prints the selected package commands without fetching the agent or invoking Tauri.
- `tauri:build` is the supported packaged build entry point; it selects the Windows resource config automatically on Windows.
- Keep changes scoped; avoid unrelated refactors.
- Do not commit secrets or large binaries.
- Do not fabricate or overstate results; preserve benchmark caveats verbatim.
