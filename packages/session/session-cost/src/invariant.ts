/**
 * Package-owned invariant companion for `@javenlu233/dsh-session-cost`.
 * @module @javenlu233/dsh-session-cost/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@javenlu233/dsh-session-cost'

/** Cordis companion plugin name. */
export const name = 'session-cost-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package owns a single pure projection fold whose
 * wire payload is schema-validated by the projection registry at every
 * snapshot and change-feed emission. Conversation usage relations
 * (`request/context` before that route's usage reports, usage buckets
 * disjoint) are owned by dsh-agent-loop and dsh-token-meter. Auxiliary
 * web_search usage is attached as opaque `tool/result` meta and folded
 * additively, so it cannot replace a conversation sample.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
