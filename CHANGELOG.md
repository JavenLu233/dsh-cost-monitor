# Changelog

本仓库三个包（`@javenlu233/dsh-session-cost`、`@javenlu233/dsh-client-ui-turn-cost`、`@javenlu233/dsh-cost-monitor`）共用版本号，一起发版。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

发版时：把 `## [Unreleased]` 里的条目挪到新版本标题下，并写上日期；三个包的 `package.json` `version` 同步改掉。

## [Unreleased]

## [0.1.4] - 2026-08-22

### Changed

- **适配 DSH session-projection 新契约**：`sessionCost` 投影从旧的 `schema` + 顶层 `view` 迁到 `stateSchema` + `wire: { viewSchema, view }`，并声明 `SessionProjectionStateMap`。在约 `0.1.1-rc.1` 起的 DSH 上，旧写法会变成 host-only，客户端读不到费用。
- 需要 DSH 已包含上述 `stateSchema` / `wire` API（约 `0.1.1-rc.1` 及以后）；更早的宿主请继续用 `0.1.3`。

### Added

- 默认价表增加 `deepseek-v4-flash-vision-exp`（与 `deepseek-v4-flash` 公布峰谷单价相同；图片 token 依赖 API 回报的 usage，不单独按分辨率换算）。
- 根目录中英 README 互链（默认展示中文 `README.md`）与仓库 `CHANGELOG.md`。

## [0.1.3] - 2026-08-18

### Added

- 捕获 DeepSeek `web_search` Messages 用量，写入 `tool/result.meta.sessionCost`，累加进触发搜索的那一轮，并在统计图中增加「搜索调用」分栏。

## [0.1.2] - 2026-08-16

### Added

- 会话费用统计图（构成、趋势、按轮 / 按模型明细）与演示图。

## [0.1.1] - 2026-08-16

### Added

- 首次对外可用的费用展示：host 侧 `sessionCost` 投影 + client 侧底部累计与每轮「本轮」费用。
- 默认 DeepSeek v4 flash / pro 平价与峰谷价表（2026-08-17 起切峰谷）。
- 聚合包 `@javenlu233/dsh-cost-monitor` 一键安装。

[Unreleased]: https://github.com/JavenLu233/dsh-cost-monitor/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/JavenLu233/dsh-cost-monitor/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/JavenLu233/dsh-cost-monitor/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/JavenLu233/dsh-cost-monitor/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/JavenLu233/dsh-cost-monitor/releases/tag/v0.1.1
