import { useEffect, useRef, useState } from 'react'

// Chunks land roughly every half second. Until the stream shows its own cadence, spread a chunk
// over this long so the first sentence types instead of appearing whole.
const DEFAULT_GAP_MS = 500
const MIN_CATCH_UP_MS = 120
const MAX_CATCH_UP_MS = 800
// Once the stream has ended, nothing else is coming: finish quickly, but still as motion.
const DRAIN_MS = 150
const HIGH_SURROGATE = /[\uD800-\uDBFF]/
// Pacing target: the markdown pipeline's own time per commit, divided by this share, is the minimum
// spacing between commits, so a costlier render waits longer for its next one. It measures the
// pipeline only, not React reconciliation or layout, so it is a target rather than a CPU guarantee.
// A frame that arrives this late means the thread is busy with something else, and commits drop to
// every other frame until frames are on time again.
const RENDER_BUDGET = 0.15
const LATE_FRAME_MS = 24
const FREE_RENDER = () => 0

/**
 * Pace a growing string so it appears a few characters per frame instead of a chunk at a time.
 *
 * The network delivers a sentence or a table row at once, then nothing for half a second, and a
 * renderer can only draw what it has. This buffer sits between the two: it keeps the revealed
 * prefix and advances it every frame at a rate that finishes the backlog by the time the next
 * chunk is likely to arrive, so the text keeps moving between chunks instead of jumping.
 *
 * The rate is fixed when new text arrives, not recomputed from the shrinking backlog, so a chunk
 * finishes in a bounded time instead of decaying toward its end. A chunk that arrives early raises
 * the rate; the backlog never lags by more than about one chunk gap.
 *
 * Text that is not a continuation of what was revealed (a reset, a finalized rewrite) shows in
 * full at once, as does anything rendered while `active` is false. When `active` turns off with
 * text still unrevealed, the remainder drains over `DRAIN_MS` rather than snapping.
 *
 * Revealing per frame multiplies commits, and each commit reparses the open trailing block, so
 * `renderCostMs` (how long the last markdown render took) paces the commits: the text keeps
 * advancing every frame, but a new commit waits until the previous one has earned its share of
 * the budget. A paragraph commits every frame; a long open table commits a few times a second.
 *
 * Per-word fade-in spans were rejected: they add a DOM node per word and break the heading text that
 * heading ids read and the citation markers in the text.
 */
export function useStreamReveal(content: string, active: boolean, renderCostMs: () => number = FREE_RENDER) {
	const [revealed, setRevealed] = useState(active ? 0 : content.length)
	const pacing = useRef({
		content: '',
		revealed: active ? 0 : content.length,
		// Fractional characters carry across frames so slow rates still advance.
		position: active ? 0 : content.length,
		rate: 0,
		lastArrivalAt: 0,
		gapMs: DEFAULT_GAP_MS,
		frame: 0,
		frameAt: 0,
		committedAt: 0,
		lateFrames: 0,
		renderCostMs
	})

	// Kept out of the pacing effect's dependencies: re-running that effect recomputes the rate from
	// the shrinking backlog, the decay the fixed rate exists to avoid, and a caller may pass a new getter
	// on every render.
	useEffect(() => {
		pacing.current.renderCostMs = renderCostMs
	})

	useEffect(() => {
		const state = pacing.current
		const previous = state.content
		state.content = content
		const grew = content.length > previous.length && content.startsWith(previous)
		const now = performance.now()
		// Snap: not streaming and nothing left to drain, or the text was replaced rather than extended.
		if ((!active && state.revealed >= previous.length) || (!grew && content !== previous)) {
			cancelAnimationFrame(state.frame)
			state.frame = 0
			state.revealed = content.length
			state.position = content.length
			state.lastArrivalAt = now
			setRevealed(content.length)
			return
		}
		if (grew && active) {
			if (state.lastArrivalAt) {
				const gap = now - state.lastArrivalAt
				// An exponential average tracks a stream that speeds up or slows down mid-answer.
				state.gapMs = state.gapMs * 0.7 + gap * 0.3
			}
			state.lastArrivalAt = now
		}
		const catchUpMs = active ? Math.min(MAX_CATCH_UP_MS, Math.max(MIN_CATCH_UP_MS, state.gapMs)) : DRAIN_MS
		state.rate = (content.length - state.position) / catchUpMs
		if (state.frame) return
		state.frameAt = now
		const step = (time: number) => {
			const dt = Math.max(0, time - state.frameAt)
			state.frameAt = time
			const target = state.content.length
			// At least one character per frame, so a tiny backlog does not stall below the eye's notice.
			state.position = Math.min(target, state.position + Math.max(1, state.rate * dt))
			let next = Math.floor(state.position)
			// Never split a surrogate pair: half an emoji renders as a replacement character.
			if (next < target && HIGH_SURROGATE.test(state.content[next - 1])) next += 1
			// Commit only once the last render has earned its budget, or when the text is complete.
			state.lateFrames = dt > LATE_FRAME_MS ? Math.min(state.lateFrames + 1, 4) : Math.max(state.lateFrames - 1, 0)
			// While frames run late, skip at least one frame between commits, whatever their length.
			const interval = Math.max(state.renderCostMs() / RENDER_BUDGET, state.lateFrames > 0 ? dt * 1.5 : 0)
			if (next >= target || time - state.committedAt >= interval) {
				state.committedAt = time
				state.revealed = next
				setRevealed(next)
			}
			state.frame = next < target ? requestAnimationFrame(step) : 0
		}
		state.frame = requestAnimationFrame(step)
	}, [content, active])

	useEffect(() => {
		const state = pacing.current
		return () => {
			cancelAnimationFrame(state.frame)
			// Strict Mode re-runs the effect above after this cleanup; it must see no loop running.
			state.frame = 0
		}
	}, [])

	const length = Math.min(revealed, content.length)
	return { text: length === content.length ? content : content.slice(0, length), revealing: length < content.length }
}
