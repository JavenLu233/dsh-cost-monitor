# @javenlu233/dsh-client-ui-turn-cost

English | [中文](README.zh.md)

Cost readout for the Web chat view: the session total (with its cache-hit / cache-miss / output split and cache-hit rate) in the composer stats strip, plus a compact per-turn increment in each assistant message's action row.

- **Data**: the session total rides the durable `sessionCost` projection (whole log, paging- and compaction-proof, priced per request by its model); the per-turn increment folds that turn's assistant nodes client-side.
- **Pricing**: the DeepSeek price table (CNY per 1M tokens), date-aware: flat before 2026-08-17 (flash hit 0.02 / miss 1 / output 2, pro 0.025 / 3 / 6), peak/off-peak after.
- **Slots**: two list slots — `conversation.composer.dock` (session total) and `conversation.chat.assistant-actions` (per-turn); composing this plugin out removes both.
- **Dependency**: requires the host `@javenlu233/dsh-session-cost` projection plugin; without it the session total is absent and only the per-turn increment renders.

## Model Experience

None; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The per-turn increment is precise only for the loaded window; compacted turns contribute to the session total but have no per-turn line.
- The price table is configurable through the host `session-cost` plugin's cordis.yml config, not the settings UI.
