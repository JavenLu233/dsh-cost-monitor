# @javenlu233/dsh-session-cost

English | [中文](README.zh.md)

Function plugin registering the `sessionCost` projection unit: whole-log token cost folded from provider usage reports and priced by a configurable per-model, peak/off-peak table, served through the session-projection seam (registry snapshot, change feed, and every projection carrier: history tail page, `session/projection` push frames, session list rows). Clients render full-session cost figures that paging and compaction cannot change; the reference consumer is the web Cost view tab.

## Pricing model

Each usage sample is attributed to the newest recorded model route (`request/context`) and to the peak/off-peak period of the sample's event time, then billed at that route's per-1M-token rate:

```
cost = uncachedInput × miss + cacheRead × hit + cacheWrite × miss + output × out
```

`cacheWrite` is billed at the miss rate because a cache write is a full-price prompt token. Prices live in `view`, never in state, so re-pricing a folded log after a config change needs no re-fold.

## Fold semantics

- Mirrors token-meter's `tokenUsage` fold: a usage chunk provides an early sample that survives a later request failure, and an assembled `assistant/message` replaces that step's sample (same `turn`/`step`), so a chunk and its message never double count.
- Auxiliary DeepSeek `web_search` usage is captured from the Messages response and attached as opaque `tool/result.meta.sessionCost`, then folded additively into the triggering turn (it never replaces conversation usage). It is priced at the search model's own rate (typically `deepseek-v4-flash`).
- `request/context` is a last-wins route record for conversation samples; a sample attributes to the newest route, falling back to `defaultRoute` when none is recorded or a route has no configured price.
- Peak windows are `[start, end)` hours in a fixed-offset timezone (default Beijing 9:00–12:00 and 14:00–18:00, +480 minutes).
- Every bucket is 0 until its first contributing event; `total` sums the four bucket costs, `cacheHitPercent` is `cacheRead / billedInput` rounded to an integer, and `billedInput` sums the three prompt-side buckets.

## Composition

```yaml
- id: session-cost
  name: '@javenlu233/dsh-session-cost'
```

All config fields default to the DeepSeek peak/off-peak table; override any field in a later patch layer. Prices are CNY per 1M tokens, keyed by provider-owned model id:

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

The default table is DeepSeek's published peak/off-peak pricing (effective 2026-08-17); deployments that price another provider or a custom rate override `prices` wholesale.

Injects `sessionProjections` — the plugin's whole purpose; in assemblies without the registry the fiber stays pending and nothing registers.

## Model Experience

Conversation tokens: none; those are already-logged usage events.

Auxiliary `web_search`: the plugin reads the existing DeepSeek Messages response (the harness already performs this call) and records its `usage` onto `tool/result` meta. It does not add tools, change the search prompt, or alter the model-visible tool result text.

#### KV Cache effect

None for conversation requests. Search-call cache traffic, when the provider reports it, is billed in the search cut.

## Known Limitations and Deferred Work

- **Estimate, not an invoice** — prices come from the configured table, the peak period uses each usage sample's event time (the assembled-message time, not the request start), and a mid-session model switch is priced only to the resolution of `request/context`; the figure may differ from a provider bill.
- **Cumulative totals only** — the fold publishes whole-session buckets, not a per-turn or per-step breakdown; the per-(route, period) keying keeps the door open for that later.
- **Cache-write is provider-optional** — DeepSeek reports no cache-write, so its sessions show a zero cache-write bucket; the bucket exists for providers that do report it.
- **Search tokens need a live capture** — sessions logged before this plugin, or `web_search` calls that never went through the `web_search` tool (direct `ctx.web.search`), have no `tool/result.meta.sessionCost` and cannot recover the flash search usage.
