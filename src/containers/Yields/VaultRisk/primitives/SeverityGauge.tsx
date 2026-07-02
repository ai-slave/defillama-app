import { useRef } from 'react'
import type { Tone } from '../kindMeta'
import { EASE_OUT_EXPO, useInViewOnce } from './motion'

// How much of the deposit the worst case can take, as a 270° arc. Resting state is always
// the final reading (SSR-safe); the % text repeats the reading so color is never the carrier.

const TONE_STROKE: Record<Tone, string> = {
	danger: 'var(--error)',
	warning: 'var(--warning)',
	good: 'var(--success)',
	neutral: 'var(--text-secondary)',
	muted: 'var(--text-tertiary)'
}

// --bg-main is invisible on white cards in light mode, so the track derives from ink.
const TONE_TRACK = 'color-mix(in srgb, var(--text-secondary) 18%, transparent)'

// 270° arc on a 132×132 box: from 135° (bottom-left) clockwise to 45° (bottom-right).
const R = 54
const C = 66
const A = R * Math.SQRT1_2 // |cos 135°| · R
const ARC = `M ${C - A} ${C + A} A ${R} ${R} 0 1 1 ${C + A} ${C + A}`

export function SeverityGauge({ pct, tone, caption }: { pct: number; tone: Tone; caption: string }) {
	const clamped = Math.max(0, Math.min(100, pct))
	const fillRef = useRef<SVGPathElement>(null)

	const rootRef = useInViewOnce<HTMLDivElement>(() => {
		const el = fillRef.current
		if (!el) return
		try {
			el.animate([{ strokeDasharray: '0 1000' }, { strokeDasharray: `${clamped} 1000` }], {
				duration: 900,
				easing: EASE_OUT_EXPO,
				fill: 'backwards'
			})
		} catch {
			/* dasharray not animatable in this engine → resting state already correct */
		}
	})

	return (
		<div
			ref={rootRef}
			role="img"
			aria-label={`${Math.round(clamped)}% ${caption}`}
			className="relative hidden size-33 shrink-0 sm:block"
		>
			<svg viewBox="0 0 132 132" className="size-full">
				<path d={ARC} fill="none" stroke={TONE_TRACK} strokeWidth="9" strokeLinecap="round" />
				{clamped > 0 ? (
					<path
						ref={fillRef}
						d={ARC}
						fill="none"
						stroke={TONE_STROKE[tone]}
						strokeWidth="9"
						strokeLinecap="round"
						pathLength={100}
						strokeDasharray={`${clamped} 1000`}
					/>
				) : null}
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-[1.75rem] font-semibold text-(--text-primary) tabular-nums">{Math.round(clamped)}%</span>
				<span className="max-w-[5.5rem] text-center text-[9px] leading-tight text-(--text-secondary)">{caption}</span>
			</div>
		</div>
	)
}
