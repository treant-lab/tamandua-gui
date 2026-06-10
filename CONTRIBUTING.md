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
npm test
(cd src-tauri && cargo check)
```

## Before opening a PR

- `build:agent` fetches the agent release binary; set TAMANDUA_AGENT_BINARY to a local path for offline builds.
- Keep changes scoped; avoid unrelated refactors.
- Do not commit secrets or large binaries.
- Do not fabricate or overstate results; preserve benchmark caveats verbatim.
