# @javenlu233/dsh-session-cost

[English](README.md) | 中文

函数插件，注册 `sessionCost` 投影单元：从 provider 用量报告折叠出全日志 token 费用，并按可配置的「按模型 × 峰谷」价格表计价，经 session-projection 接缝（registry 快照、变更流，以及各投影载体）对外提供。客户端渲染的是分页与压缩都无法改变的整会话费用；参考消费方是 Web 的「费用」Tab。

## 计价模型

每条用量样本归属到最新记录的模型路由（`request/context`），并按样本事件时间落入峰/谷时段，再按该路由的每百万 token 单价计价：

```
cost = uncachedInput × miss + cacheRead × hit + cacheWrite × miss + output × out
```

`cacheWrite` 按未命中单价计（缓存写是全额 prompt token）。价格只放在 `view` 中、从不进 state，因此改配置后对已折叠日志重新计价无需重新折叠。

## 折叠语义

- 与 token-meter 的 `tokenUsage` 折叠一致：usage chunk 提供早到样本（请求失败后仍保留），组装出的 `assistant/message` 会替换同 `turn`/`step` 的样本，chunk 与 message 不会重复计数。
- `request/context` 是 last-wins 路由记录；样本归属到最新路由，无记录或路由无配置价时回退到 `defaultRoute`。
- 峰谷窗口为固定时区下的 `[start, end)` 小时区间（默认北京时间 9:00–12:00、14:00–18:00，偏移 +480 分钟）。
- 各桶在首个贡献事件前为 0；`total` 为四桶费用之和，`cacheHitPercent` 为 `cacheRead / billedInput` 四舍五入取整，`billedInput` 为三个 prompt 侧桶之和。

## 组合

```yaml
- id: session-cost
  name: '@javenlu233/dsh-session-cost'
```

所有配置字段默认取 DeepSeek 峰谷价格表；可在后续 patch 层覆盖任一字段。价格为人民币 / 百万 token，按 provider 侧模型 id 为键：

```yaml
- id: session-cost
  name: '@javenlu233/dsh-session-cost'
  config:
    currency: CNY
    defaultRoute: deepseek-v4-flash
    peakWindows: [[9, 12], [14, 18]]
    timezoneOffsetMinutes: 480
    prices:
      deepseek-v4-flash:
        peak: { cacheRead: 0.10, uncachedInput: 3.0, cacheWrite: 3.0, output: 9.0 }
        offPeak: { cacheRead: 0.05, uncachedInput: 1.5, cacheWrite: 1.5, output: 4.5 }
      deepseek-v4-pro:
        peak: { cacheRead: 0.30, uncachedInput: 9.0, cacheWrite: 9.0, output: 27.0 }
        offPeak: { cacheRead: 0.15, uncachedInput: 4.5, cacheWrite: 4.5, output: 13.5 }
```

默认表为 DeepSeek 公布的峰谷价格（2026-08-17 生效）；为其他 provider 或自定义费率计价时整体覆盖 `prices`。

注入 `sessionProjections` —— 这是插件的全部目的；在没有 registry 的组合中 fiber 保持 pending，不注册任何东西。

## Model Experience

无。该插件只计算已记录用量事件的客户端只读模型，不接触 prompt、message、schema、流或工具结果。

#### KV Cache effect

无；该插件从不组装或发送 provider 请求。

## Known Limitations and Deferred Work

- **是估算，不是账单** —— 价格来自配置表，峰谷时段取各用量样本的事件时间（组装 message 的时间，而非请求开始时间），会话中途切换模型也只按 `request/context` 的分辨率计价，结果可能与 provider 账单有出入。
- **仅累计总量** —— 折叠只发布整会话分桶，不提供按轮次/步骤的明细；按 (route, period) 的键结构为后续细分保留了扩展位。
- **cache-write 由 provider 可选上报** —— DeepSeek 不上报 cache-write，因此其会话的缓存写桶恒为 0；该桶为上报此指标的 provider 保留。
