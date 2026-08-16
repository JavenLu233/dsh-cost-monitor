# dsh-cost-plugin

DeepSeek Harness (DSH) 费用展示插件，按真实场景通过 `dsh plugin` 安装，不改 DSH 源码。

- `@javenlu233/dsh-session-cost` — host 侧投影（`sessionCost`），按每次请求的模型/时间计价。
- `@javenlu233/dsh-client-ui-turn-cost` — client 侧展示（底部累计 + 每消息「本轮」）。
- `@javenlu233/dsh-cost-monitor` — 聚合包，一键装齐上面两个。

## 结构

```
cost-plugin/
├─ packages/
│  ├─ session/session-cost/    # host 投影
│  ├─ client/ui-turn-cost/     # client 展示（dsh.client 浏览器半）
│  └─ cost-monitor/                # 聚合包：汇总的 cordis.patch.yml
├─ scripts/link-profile.mjs    # 把子包 junction 进 ~/.dsh/profiles/node_modules/@javenlu233
├─ package.json / pnpm-workspace.yaml / .npmrc
```

## 构建

```bash
pnpm install
pnpm build   # 或 pnpm -r build
```

产物：`packages/*/*/lib/{index,invariant}.js` + `packages/client/ui-turn-cost/lib/client.js`。

## 本地调试安装（不改 DSH 源码）

```bash
# 1. 构建
pnpm install && pnpm build

# 2. 把子包链接进 profile（聚合包的 children 依赖靠这个解析）
node scripts/link-profile.mjs

# 3. 用本地 link 装聚合包（把 <repo> 换成仓库根目录的绝对路径）
dsh plugin --profile web add "link:<repo>/packages/cost-monitor"

# 4. 重启 dsh web + 硬刷新
```

验证：`dsh --profile web --dump-config` 应出现 `# == @javenlu233/dsh-cost-monitor` 及
`session-cost` / `ui-turn-cost` 两行。

卸载：`dsh plugin --profile web remove @javenlu233/dsh-cost-monitor`，再重启。

## 发布

包发布在 `@javenlu233` scope，步骤见 [PUBLISHING.md](./PUBLISHING.md)。发布后用户侧改用：

```bash
dsh plugin --profile web add @javenlu233/dsh-cost-monitor
```

不再需要本地 `link:`。

## 已知限制

`dsh-session-cost` 依赖 host 的 `sessionProjections` 投影服务、`ui-turn-cost` 依赖
`composer.dock` / `assistant-actions` 两个 slot。这些 API 来自 DSH 的 `@deepseek-ai/dsh-*`
官方包；独立构建时它们作为 external 不打包、也不作为 devDependencies 安装（否则会拉取
npm 上尚未发布的传递依赖），改为在 peerDependencies 中声明、由真实 `dsh web` 宿主提供。
因此在「本地 link + 真实 dsh web」下可跑；发布到 npm 供他人安装时，需确认对方 DSH 版本
已包含上述 API。
