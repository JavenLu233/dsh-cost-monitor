# 发布到 npm

本仓库包含三个 npm 包，通过聚合包 `@javenlu233/dsh-cost-monitor` 一键安装：

| 顺序 | 包 | 作用 |
| --- | --- | --- |
| 1 | `@javenlu233/dsh-session-cost` | host 侧投影（`sessionCost`） |
| 2 | `@javenlu233/dsh-client-ui-turn-cost` | client 侧展示（底部累计 + 每消息「本轮」） |
| 3 | `@javenlu233/dsh-cost-monitor` | 聚合包（`dsh.bundle.patch` + 汇总的 cordis.patch.yml） |

## 前置条件

- 已登录 **官方 npm**（`https://registry.npmjs.org`），且当前账号拥有 `@javenlu233` scope 的发布权限：

  ```bash
  npm whoami --registry=https://registry.npmjs.org
  ```

  本机安装源可以继续用镜像；发布目标由仓库 `.npmrc` 的 `publish-registry` 和各包 `publishConfig.registry` 固定为官网，不必再加 `--registry`。

- 已安装 pnpm（发布必须用 `pnpm publish`，原因见文末「注意事项」）。
  若账号开了 2FA，发布时加 `--otp=<验证码>`，或使用带 Bypass 2FA 的 granular token。

## 发布步骤

**发布顺序不能反**：`cost-monitor` 依赖前两个包，必须先发 `session-cost`、`ui-turn-cost`，最后发 `cost-monitor`。

日常流程是：本地 `link:` 调通 → 发 **beta**（`--tag beta`）→ PR 合进 `main` → 再发正式包。完整说明见仓库 [README.md](./README.md) 的「发布流程」。

### 正式包（`latest`）

三个包的 `version` 改成正式号（例如 `0.1.2`）。在仓库根目录：

```bash
pnpm build

cd packages/session/session-cost
pnpm publish
cd ../../..

cd packages/client/ui-turn-cost
pnpm publish
cd ../../..

cd packages/cost-monitor
pnpm publish
cd ../..
```

工作区不干净时加 `--no-git-checks`。不要加 `--tag`，默认就是 `latest`。

### beta 包（不覆盖 `latest`）

三个包改成预发布号（例如 `0.1.2-beta.0`），同样顺序，带 `--tag beta`：

```bash
pnpm publish --tag beta --no-git-checks
```

安装时必须指定 tag 或完整版本：`dsh plugin --profile web add @javenlu233/dsh-cost-monitor@beta`。

如果中途提示 OTP / 2FA，输入 npm 的二次验证码即可。

## 发布后验证

三个包都应返回本次正式号（例如 `0.1.2`）：

```bash
npm view @javenlu233/dsh-session-cost version
npm view @javenlu233/dsh-client-ui-turn-cost version
npm view @javenlu233/dsh-cost-monitor version
```

## npx 场景安装验证

```bash
# 装聚合包（钉死版本，与 README 安装段一致）
npx @deepseek-ai/dsh plugin --profile web add @javenlu233/dsh-cost-monitor@0.1.3

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

npm 不允许覆盖已发布的版本。再次发布前，把三个包的 `version` 都改成新版本（例如 `0.1.2` 或 `0.1.3-beta.0`），再按上面的顺序重新 `pnpm publish`。

### 宿主版本依赖

`session-cost` 依赖宿主提供的 `sessionProjections` 投影服务；`ui-turn-cost` 依赖 `composer.dock` / `assistant-actions` 两个 slot。这些 API 由 `@deepseek-ai/dsh-*`（`0.1.0-rc.6` 及以上）提供。若使用者安装的 DSH 版本过旧，插件安装成功但 UI 不会出现。
