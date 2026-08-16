# dsh-cost-plugin

DeepSeek Harness (DSH) 费用展示插件: 底部累计 + 每轮费用。

![费用展示：底部累计 + 每轮本轮费用](docs/demo.gif)

- `@javenlu233/dsh-session-cost` — host 侧投影（`sessionCost`），按每次请求的模型/时间计价。
- `@javenlu233/dsh-client-ui-turn-cost` — client 侧展示（底部累计 + 每消息「本轮」）。
- `@javenlu233/dsh-cost-monitor` — 聚合包，一键装齐上面两个。

## 安装（使用者）

装好 [Node.js](https://nodejs.org/) 后执行：

```bash
npx @deepseek-ai/dsh plugin --profile web add @javenlu233/dsh-cost-monitor
npx @deepseek-ai/dsh web
```

浏览器打开后，插件有时不会立刻出现：等几秒再强制刷新（Windows / Linux：`Ctrl+Shift+R`，macOS：`Cmd+Shift+R`）。底部应出现「累计费用」，每条助手消息有「费用」按钮。若刷新后仍没有，关掉 `dsh web` 再启动一次，然后再强制刷新。

本机已有 `dsh` 命令时，把 `npx @deepseek-ai/dsh` 换成 `dsh` 即可。需要 DSH `0.1.0-rc.6` 及以上。

卸载：

```bash
npx @deepseek-ai/dsh plugin --profile web remove @javenlu233/dsh-cost-monitor
```

更新（不必改版本号或 lockfile）：

```bash
npx @deepseek-ai/dsh plugin --profile web update
```

`add` 时写入的是 `^0.1.0` 这类范围，`update` 会在范围内升到最新（`0.1.1`、`0.1.2`…）。刚发布几分钟的版本有时会被 pnpm 的发布冷却拦住，这时指定版本再 add 一次即可：

```bash
npx @deepseek-ai/dsh plugin --profile web add @javenlu233/dsh-cost-monitor@latest
```

更新后重启 `dsh web` 并强制刷新。

## 计价

费用为按配置表的**估算**，不是官方账单。每条用量按当时的模型（`request/context`）和事件时间落入下表，单位为 **人民币 / 百万 token**。缓存写入按未命中价计。未记录模型或表中没有该模型时，回退到 `deepseek-v4-flash`。

内置 DeepSeek 价格（2026-08-17 00:00 北京时间起从平价切到峰谷；峰时为北京时间 9:00–12:00、14:00–18:00）：

| 模型 | 时段 | 命中 | 未命中 | 缓存写 | 输出 |
| --- | --- | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | 平价（涨价前） | 0.02 | 1 | 1 | 2 |
| | 峰时 | 0.10 | 3 | 3 | 9 |
| | 谷时 | 0.05 | 1.5 | 1.5 | 4.5 |
| `deepseek-v4-pro` | 平价（涨价前） | 0.025 | 3 | 3 | 6 |
| | 峰时 | 0.30 | 9 | 9 | 27 |
| | 谷时 | 0.15 | 4.5 | 4.5 | 13.5 |

### 自定义价格

编辑 profile 的 `cordis.patch.yml`（默认 `~/.dsh/profiles/web/cordis.patch.yml`），按 id 覆盖 `session-cost` 的 `config`。patch **整段替换** `config`，不会和默认表做字段级合并；`prices` 也是整表替换，要改价请把用到的模型都写全。未写的配置项仍走插件 schema 默认值。

```yaml
- id: session-cost
  config:
    currency: CNY
    defaultRoute: deepseek-v4-flash
    # 2026-08-17 00:00 北京时间；更早的用量走 flat
    effectiveAt: 1786896000000
    peakWindows: [[9, 12], [14, 18]]
    timezoneOffsetMinutes: 480
    prices:
      deepseek-v4-flash:
        flat: { cacheRead: 0.02, uncachedInput: 1, cacheWrite: 1, output: 2 }
        peak: { cacheRead: 0.10, uncachedInput: 3, cacheWrite: 3, output: 9 }
        offPeak: { cacheRead: 0.05, uncachedInput: 1.5, cacheWrite: 1.5, output: 4.5 }
      deepseek-v4-pro:
        flat: { cacheRead: 0.025, uncachedInput: 3, cacheWrite: 3, output: 6 }
        peak: { cacheRead: 0.30, uncachedInput: 9, cacheWrite: 9, output: 27 }
        offPeak: { cacheRead: 0.15, uncachedInput: 4.5, cacheWrite: 4.5, output: 13.5 }
```

给其他模型加价：在 `prices` 里用 provider 侧模型 id 再加一项。改完后重启 `dsh web`。

## 开发

### 结构

```
cost-plugin/
├─ packages/
│  ├─ session/session-cost/    # host 投影
│  ├─ client/ui-turn-cost/     # client 展示（dsh.client 浏览器半）
│  └─ cost-monitor/                # 聚合包：汇总的 cordis.patch.yml
├─ scripts/link-profile.mjs    # 把子包 junction 进 ~/.dsh/profiles/node_modules/@javenlu233
├─ package.json / pnpm-workspace.yaml / .npmrc
```

### 构建

```bash
pnpm install
pnpm build   # 或 pnpm -r build
```

产物：`packages/*/*/lib/{index,invariant}.js` + `packages/client/ui-turn-cost/lib/client.js`。

### 本地调试安装（不改 DSH 源码）

```bash
# 1. 构建
pnpm install && pnpm build

# 2. 把子包链接进 profile（聚合包的 children 依赖靠这个解析）
node scripts/link-profile.mjs

# 3. 用本地 link 装聚合包（把 <repo> 换成仓库根目录的绝对路径）
# 如果是在 harness 仓库，改为 pnpm dsh ... 即可
dsh plugin --profile web add "link:<repo>/packages/cost-monitor"

# 4. 重启 dsh web；打开页面后等几秒再强制刷新（Ctrl+Shift+R / Cmd+Shift+R）
dsh web
```

验证：`dsh --profile web --dump-config` 应出现 `# == @javenlu233/dsh-cost-monitor` 及
`session-cost` / `ui-turn-cost` 两行。

卸载：`dsh plugin --profile web remove @javenlu233/dsh-cost-monitor`，再重启。

### 发布

维护者发包步骤见 [PUBLISHING.md](./PUBLISHING.md)。用户侧安装见上文「安装（使用者）」，不再使用本地 `link:`。

## 已知限制

`dsh-session-cost` 依赖 host 的 `sessionProjections` 投影服务、`ui-turn-cost` 依赖
`composer.dock` / `assistant-actions` 两个 slot。这些 API 来自 DSH 的 `@deepseek-ai/dsh-*`
官方包；独立构建时它们作为 external 不打包、也不作为 devDependencies 安装（否则会拉取
npm 上尚未发布的传递依赖），改为在 peerDependencies 中声明、由真实 `dsh web` 宿主提供。
因此在「本地 link + 真实 dsh web」下可跑；需确认DSH 版本
已包含上述 API。

## License

MIT，见 [LICENSE](./LICENSE)。
