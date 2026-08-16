# @javenlu233/dsh-client-ui-turn-cost

[English](README.md) | 中文

Web 对话视图的费用展示：底部统计条显示整会话累计（含命中 / 未命中 / 输出分桶与缓存命中率），每条助手消息操作行显示该回合增量。

- **数据**：整会话累计来自持久的 `sessionCost` 投影（整份日志，分页/压缩不变，按每次请求的模型计价）；该回合增量由该回合的 assistant 节点在客户端折叠。
- **计价**：DeepSeek 价格表（每百万 token，人民币），日期感知：2026-08-17 前平价（flash 命中 0.02 / 未命中 1 / 输出 2，pro 0.025 / 3 / 6），之后峰谷。
- **插槽**：两个 list 插槽 —— `conversation.composer.dock`（整会话累计）与 `conversation.chat.assistant-actions`（该回合增量）；从 cordis.yml 去掉该插件即整体移除。
- **依赖**：需要 host 侧 `@javenlu233/dsh-session-cost` 投影插件；缺少它时整会话累计不显示，只显示该回合增量。

## 模型体验

无；本包没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与后续工作

- 该回合增量仅在「已加载窗口」内精确；被压缩的回合计入整会话累计，但无逐条费用行。
- 价格表通过 host 侧 `session-cost` 插件的 cordis.yml 配置，不在设置界面里。
