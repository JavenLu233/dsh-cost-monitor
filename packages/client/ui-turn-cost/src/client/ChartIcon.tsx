/**
 * Bar-chart glyph for the session cost stats toggle. 16px, tinted by
 * `currentColor` so it inherits the dock button's label color.
 *
 * @author linqiya.1
 * @date 2026-08-16 19:45
 */

/** Render the 16px chart glyph. */
export function ChartIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M2 13.5V8h2v5.5H2zm5 0V3h2v10.5H7zm5 0V6h2v7.5h-2zM1 14.75h14v1.25H1z" />
    </svg>
  )
}
