# 发布到 npm

本仓库包含三个 npm 包，通过聚合包 `@javenlu233/dsh-cost-monitor` 一键安装：

| 顺序 | 包 | 作用 |
| --- | --- | --- |
| 1 | `@javenlu233/dsh-session-cost` | host 侧投影（`sessionCost`） |
| 2 | `@javenlu233/dsh-client-ui-turn-cost` | client 侧展示（底部累计 + 每消息「本轮」） |
| 3 | `@javenlu233/dsh-cost-monitor` | 聚合包（`dsh.bundle.patch` + 汇总的 cordis.patch.yml） |

## 前置条件

- 已登录 npm，且登录用户拥有 `@javenlu233` scope：

  ```powershell
  npm whoami          # 应输出 javenlu233
  ```

- 已安装 pnpm（发布必须用 `pnpm publish`，原因见文末「注意事项」）。

## 发布步骤

**发布顺序不能反**：`cost-monitor` 依赖前两个包，必须先发 `session-cost`、`ui-turn-cost`，最后发 `cost-monitor`。

```powershell
cd C:\desktop\dsh-workspace\cost-plugin

# 可选：确保构建产物是最新的（lib/index.js、lib/client.js 等）
pnpm build

# 1. host 投影
cd packages\session\session-cost
pnpm publish
cd ..\..\..

# 2. client 展示
cd packages\client\ui-turn-cost
pnpm publish
cd ..\..\..

# 3. 聚合包
cd packages\cost-monitor
pnpm publish
cd ..\..\..
```

如果中途提示 OTP / 2FA，输入 npm 的二次验证码即可。

## 发布后验证

三个包都应返回 `0.1.0`（或你本次 bump 的版本号）：

```powershell
npm view @javenlu233/dsh-session-cost version
npm view @javenlu233/dsh-client-ui-turn-cost version
npm view @javenlu233/dsh-cost-monitor version
```

## npx 场景安装验证

```powershell
# 装聚合包（真实场景）
npx @deepseek-ai/dsh plugin --profile web add @javenlu233/dsh-cost-monitor

# 确认配置层已挂载
npx @deepseek-ai/dsh --profile web --dump-config
```

`--dump-config` 输出里应出现：

```yaml
# == @javenlu233/dsh-cost-monitor
- id: session-cost
  name: '@javenlu233/dsh-session-cost'
- id: ui-turn-cost
  name: '@javenlu233/dsh-client-ui-turn-cost'
```

然后重启 `dsh web` + 硬刷新，底部「累计费用」和每消息「费用」按钮出现即成功。

## 注意事项

### 必须用 `pnpm publish`，不要用 `npm publish`

`cost-monitor` 的子包依赖写的是 `workspace:^`：

```json
"dependencies": {
  "@javenlu233/dsh-session-cost": "workspace:^",
  "@javenlu233/dsh-client-ui-turn-cost": "workspace:^"
}
```

- 本地 `pnpm install` 时，`workspace:^` 会 link 到仓库里的 workspace 成员。
- `pnpm publish` 打包时，会把 `workspace:^` 转成 `^0.1.0` 再发布（已用 `pnpm pack` 验证）。
- `npm publish` 不认识 `workspace:` 协议，会原样发出去，导致别人安装时解析失败。

### 再次发布时先 bump 版本号

npm 不允许覆盖已发布的版本。再次发布前，把三个包的 `version` 都改成新版本（例如 `0.1.1`），再按上面的顺序重新 `pnpm publish`。

### 宿主版本依赖

`session-cost` 依赖宿主提供的 `sessionProjections` 投影服务；`ui-turn-cost` 依赖 `composer.dock` / `assistant-actions` 两个 slot。这些 API 由 `@deepseek-ai/dsh-*`（`0.1.0-rc.6` 及以上）提供。若使用者安装的 DSH 版本过旧，插件安装成功但 UI 不会出现。
