# dsh-cost-plugin

[中文](README.md) | English

[![npm version](https://img.shields.io/npm/v/@javenlu233/dsh-cost-monitor.svg)](https://www.npmjs.com/package/@javenlu233/dsh-cost-monitor)
[![npm total downloads](https://img.shields.io/npm/dt/@javenlu233/dsh-cost-monitor.svg)](https://www.npmjs.com/package/@javenlu233/dsh-cost-monitor)
[![license](https://img.shields.io/npm/l/@javenlu233/dsh-cost-monitor.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.1.1--rc.1-black)](https://www.npmjs.com/package/@deepseek-ai/dsh)

DeepSeek Harness (DSH) cost display plugin: session total in the composer dock, per-turn cost on each assistant message, plus session cost charts.

![Cost display: session total + per-turn cost](docs/demo.gif)

![Cost stats: composition, trend, and per-turn detail](docs/charts.png)

- `@javenlu233/dsh-session-cost` — host projection (`sessionCost`), priced per request by model and time.
- `@javenlu233/dsh-client-ui-turn-cost` — client UI (session total + per-message “this turn”).
- `@javenlu233/dsh-cost-monitor` — aggregate package that installs both.

## Install (end users)

With [Node.js](https://nodejs.org/) installed:

```bash
npx @deepseek-ai/dsh plugin --profile web add @javenlu233/dsh-cost-monitor@0.1.3 # pin the release you want
npx @deepseek-ai/dsh web
```

> Pin the version: the DSH web profile cools new npm packages for 24 hours. Bare names or `@latest` may skip a just-published `0.1.3` and install an older build.

After the browser opens, wait a few seconds and hard-refresh (Windows / Linux: `Ctrl+Shift+R`, macOS: `Cmd+Shift+R`). You should see the session total at the bottom and a cost control on each assistant message. If not, restart `dsh web` and hard-refresh again.

If you already have a `dsh` binary, use that instead of `npx @deepseek-ai/dsh`. Requires DSH `0.1.1-rc.1` or newer (the `session-projection` `stateSchema` / `wire` contract).

Uninstall:

```bash
npx @deepseek-ai/dsh plugin --profile web remove @javenlu233/dsh-cost-monitor
```

### Update to the latest release

Remove the old install, then add the pinned release from the install section above. Do not use a bare name or `@latest` (same cooldown reason):

```bash
npx @deepseek-ai/dsh plugin --profile web remove @javenlu233/dsh-cost-monitor
npx @deepseek-ai/dsh plugin --profile web add @javenlu233/dsh-cost-monitor@0.1.3
```

Restart `dsh web` and hard-refresh.

Check what is installed and what npm reports as latest:

```bash
npx @deepseek-ai/dsh plugin --profile web list
npm view @javenlu233/dsh-cost-monitor version
```

## Historical sessions

Cost is folded from the session’s full usage log. The plugin need not have been installed when the session was recorded. After install and restart, older sessions still show a whole-log total; assistant messages still in the window also get a “this turn” line.

Paging and compaction do not change the session total. Compressed turns that are no longer in the window have no per-turn row, but their cost remains in the total. Each usage sample is priced by its own event time (flat before 2026-08-17, peak/off-peak after), so sessions that cross the price change are billed by period.

## Pricing

Figures are **estimates** from the configured table, not an official invoice: peak/off-peak uses each sample’s event time (assembled-message time, not request start), and mid-session model switches are priced only at `request/context` resolution. Results may differ from the provider bill. Units are **CNY per 1M tokens**. Cache writes are billed at the miss rate. Missing or unknown model ids fall back to `deepseek-v4-flash`.

Built-in DeepSeek prices (flat → peak/off-peak from 2026-08-17 00:00 Beijing time; peak windows Beijing 9:00–12:00 and 14:00–18:00):

| Model | Period | Hit | Miss | Cache write | Output |
| --- | --- | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | Flat (pre-change) | 0.02 | 1 | 1 | 2 |
| | Peak | 0.10 | 3 | 3 | 9 |
| | Off-peak | 0.05 | 1.5 | 1.5 | 4.5 |
| `deepseek-v4-flash-vision-exp` | Flat (pre-change) | 0.02 | 1 | 1 | 2 |
| | Peak | 0.10 | 3 | 3 | 9 |
| | Off-peak | 0.05 | 1.5 | 1.5 | 4.5 |
| `deepseek-v4-pro` | Flat (pre-change) | 0.025 | 3 | 3 | 6 |
| | Peak | 0.30 | 9 | 9 | 27 |
| | Off-peak | 0.15 | 4.5 | 4.5 | 13.5 |

`deepseek-v4-flash-vision-exp` matches flash’s published rates; image tokens are already included in API-reported input usage — the plugin does not recompute from image dimensions.

### Custom prices

Edit the profile’s `cordis.patch.yml` (default `~/.dsh/profiles/web/cordis.patch.yml`) and override `session-cost` `config` by id. A patch **replaces** `config` wholesale (no field-level merge with defaults); `prices` is also replaced wholesale, so include every model you need. Omitted top-level config keys still use schema defaults.

```yaml
- id: session-cost
  config:
    currency: CNY
    defaultRoute: deepseek-v4-flash
    # 2026-08-17 00:00 Beijing; earlier usage uses flat
    effectiveAt: 1786896000000
    peakWindows: [[9, 12], [14, 18]]
    timezoneOffsetMinutes: 480
    prices:
      deepseek-v4-flash:
        flat: { cacheRead: 0.02, uncachedInput: 1, cacheWrite: 1, output: 2 }
        peak: { cacheRead: 0.10, uncachedInput: 3, cacheWrite: 3, output: 9 }
        offPeak: { cacheRead: 0.05, uncachedInput: 1.5, cacheWrite: 1.5, output: 4.5 }
      deepseek-v4-flash-vision-exp:
        flat: { cacheRead: 0.02, uncachedInput: 1, cacheWrite: 1, output: 2 }
        peak: { cacheRead: 0.10, uncachedInput: 3, cacheWrite: 3, output: 9 }
        offPeak: { cacheRead: 0.05, uncachedInput: 1.5, cacheWrite: 1.5, output: 4.5 }
      deepseek-v4-pro:
        flat: { cacheRead: 0.025, uncachedInput: 3, cacheWrite: 3, output: 6 }
        peak: { cacheRead: 0.30, uncachedInput: 9, cacheWrite: 9, output: 27 }
        offPeak: { cacheRead: 0.15, uncachedInput: 4.5, cacheWrite: 4.5, output: 13.5 }
```

Add other models under `prices` with the provider-owned model id. Restart `dsh web` after edits.

## Development

### Layout

```
cost-plugin/
├─ packages/
│  ├─ session/session-cost/    # host projection
│  ├─ client/ui-turn-cost/     # client UI (dsh.client browser half)
│  └─ cost-monitor/            # aggregate: merged cordis.patch.yml
├─ scripts/link-profile.mjs    # junction family packages into ~/.dsh/profiles/node_modules/@javenlu233
├─ package.json / pnpm-workspace.yaml / .npmrc
```

### Build

```bash
pnpm install
pnpm build   # or pnpm -r build
```

Artifacts: `packages/*/*/lib/{index,invariant}.js` + `packages/client/ui-turn-cost/lib/client.js`.

After code changes: `pnpm build` (or build only what changed) → restart `dsh web` → `Ctrl+Shift+R`. Re-run `link-profile` only when package paths change.

### Release flow

Follow this path; do not skip beta straight to `latest`:

1. **Local link** until it works
2. **Publish beta**, verify with npm `@beta`
3. **PR into `main`**
4. **Publish the release** (`latest`)

Publishing details (order, OTP, `workspace:^`) are in [PUBLISHING.md](./PUBLISHING.md). All three package `version` fields must move together. Before a release, move [CHANGELOG.md](./CHANGELOG.md) `Unreleased` entries under the new version heading with a date.

#### 1. Local link

Do not patch DSH source. On Windows, run `pnpm dsh ...` from the harness repo; avoid `npx @deepseek-ai/dsh` (the bin may point at a missing `lib/bin.js`).

```bash
# 1. Build
pnpm install && pnpm build

# 2. Link family packages into the profile (children of the aggregate resolve through this)
node scripts/link-profile.mjs

# 3. Install the aggregate via local link (replace <repo> with the repo root absolute path)
dsh plugin --profile web remove @javenlu233/dsh-cost-monitor
dsh plugin --profile web add "link:<repo>/packages/cost-monitor"

# 4. Restart dsh web; wait a few seconds after open, then hard-refresh
dsh web
```

Check: `dsh --profile web --dump-config` should show `# == @javenlu233/dsh-cost-monitor` and both `session-cost` / `ui-turn-cost` rows.

#### 2. Publish beta

Bump all three packages to a prerelease (e.g. previous release `0.1.1` → `0.1.2-beta.0`), build, publish with `--tag beta` (does **not** move `latest`):

```bash
pnpm build

cd packages/session/session-cost && pnpm publish --tag beta --no-git-checks && cd ../../..
cd packages/client/ui-turn-cost && pnpm publish --tag beta --no-git-checks && cd ../../..
cd packages/cost-monitor && pnpm publish --tag beta --no-git-checks && cd ../..
```

Remove the link and install beta:

```bash
dsh plugin --profile web remove @javenlu233/dsh-cost-monitor
dsh plugin --profile web add @javenlu233/dsh-cost-monitor@beta
```

Use `@beta` or the full prerelease. Do not use a bare name or `@latest`. Restart `dsh web` and hard-refresh.

#### 3. PR into main

After beta checks out, open a PR and merge to `main`. Do not publish the release before merge.

#### 4. Publish the release

On `main`, set all three `version` fields to the release (e.g. `0.1.3`, drop `-beta.0`), build, and publish **without** `--tag` (default `latest`). Then update the pinned `@0.1.3` in the install section above.

```bash
pnpm build

cd packages/session/session-cost && pnpm publish --no-git-checks && cd ../../..
cd packages/client/ui-turn-cost && pnpm publish --no-git-checks && cd ../../..
cd packages/cost-monitor && pnpm publish --no-git-checks && cd ../..
```

Verify with the same pinned version (remove, then add):

```bash
dsh plugin --profile web remove @javenlu233/dsh-cost-monitor
dsh plugin --profile web add @javenlu233/dsh-cost-monitor@0.1.3
```

Restart and hard-refresh.

## Known limitations

Values are estimates: peak/off-peak uses message-assembly time, model switches only at `request/context` granularity, and figures may diverge from the provider bill. `web_search`-triggered flash summary usage appears in the turn total and the chart’s search cut; sessions recorded before the plugin was installed cannot recover that cut. Vision image cost depends on API-reported usage (images already folded into input tokens); the plugin does not reprice by resolution.

`dsh-session-cost` needs the host `sessionProjections` service; `ui-turn-cost` needs the `composer.dock` / `assistant-actions` slots. Those APIs come from DSH’s `@deepseek-ai/dsh-*` packages. Standalone builds leave them external and do not install them as devDependencies (that would pull unpublished transitive deps); they are peer-provided by a real `dsh web` host. Local link + real `dsh web` works; confirm the DSH version includes the APIs and the `session-projection` `stateSchema` + `wire` contract (about `0.1.1-rc.1` onward).

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT; see [LICENSE](./LICENSE).
