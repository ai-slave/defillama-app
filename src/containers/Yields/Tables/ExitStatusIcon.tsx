// The Exit status mark. Sprite icons at one stroke weight replace the old text glyphs, which mixed
// an emoji stopwatch with font-dependent shapes and never sat at the row's size. The ring is drawn
// here because its arc IS the withdrawable share; a closed door is the sprite's `ban`. The tone
// color rides on this icon alone; the text beside it keeps the table's colors.
import { Icon } from '~/ui/Icon'
import { withdrawableFraction } from '../data/exit'
import type { VerifiedBlock } from '../data/types'
import { EXIT_TONE_CLASS, exitTone } from '../domain/exitPresentation'

const RING_RADIUS = 6
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const STROKE = 2.25

export function ExitStatusIcon({ verified, className }: { verified: VerifiedBlock; className?: string }) {
	const status = verified.exit?.status
	if (!status) return null
	const tone = `size-3.5 shrink-0 ${EXIT_TONE_CLASS[exitTone(verified)]} ${className ?? ''}`.trim()

	if (status === 'partial' || status === 'depleted') {
		// The arc is the withdrawable share, the number printed beside it. A depleted lane draws the
		// track at full strength with no arc: an empty ring, the "nothing in it" mark. A faint track
		// alone is a share we could not size; a sliver still gets a visible tick.
		const fraction = status === 'depleted' ? null : withdrawableFraction(verified)
		const empty = status === 'depleted'
		const arc = fraction != null && fraction > 0 ? Math.max(fraction * RING_CIRCUMFERENCE, 1.5) : null
		return (
			<svg viewBox="0 0 16 16" className={tone} aria-hidden>
				<circle
					cx="8"
					cy="8"
					r={RING_RADIUS}
					fill="none"
					stroke="currentColor"
					strokeOpacity={empty ? 1 : 0.25}
					strokeWidth={STROKE}
				/>
				{arc != null ? (
					<circle
						cx="8"
						cy="8"
						r={RING_RADIUS}
						fill="none"
						stroke="currentColor"
						strokeWidth={STROKE}
						strokeDasharray={`${arc} ${RING_CIRCUMFERENCE}`}
						transform="rotate(-90 8 8)"
					/>
				) : null}
			</svg>
		)
	}

	if (status === 'unavailable') return <Icon name="ban" className={tone} aria-hidden />

	const name = status === 'instant' ? 'check' : status === 'queued' ? 'clock' : 'circle-x'
	return <Icon name={name} className={tone} aria-hidden />
}
