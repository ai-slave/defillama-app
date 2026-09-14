import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '~/hooks/usePrefersReducedMotion'

const COUNT_UP_START_FRACTION = 0.6

interface UseCountUpOptions {
	enabled: boolean
	duration?: number
}

function runCountUp(
	from: number,
	to: number,
	duration: number,
	onFrame: (value: number) => void,
	onDone: () => void
): () => void {
	const span = to - from
	let startedAt: number | null = null
	let frame = requestAnimationFrame(function step(now: number) {
		if (startedAt === null) startedAt = now
		const progress = duration > 0 ? Math.min((now - startedAt) / duration, 1) : 1
		onFrame(from + span * (1 - (1 - progress) ** 4))
		if (progress < 1) frame = requestAnimationFrame(step)
		else onDone()
	})
	return () => cancelAnimationFrame(frame)
}

export function useCountUp(value: number | null | undefined, { enabled, duration = 400 }: UseCountUpOptions) {
	const [settledValue, setSettledValue] = useState(value)
	const [displayValue, setDisplayValue] = useState(value)
	const [animationTarget, setAnimationTarget] = useState<number | null>(null)

	if (value !== settledValue) {
		const animates =
			enabled &&
			value != null &&
			settledValue == null &&
			typeof requestAnimationFrame === 'function' &&
			!prefersReducedMotion()
		setSettledValue(value)
		setDisplayValue(animates ? value * COUNT_UP_START_FRACTION : value)
		setAnimationTarget(animates ? value : null)
	}

	useEffect(() => {
		if (animationTarget == null) return
		return runCountUp(animationTarget * COUNT_UP_START_FRACTION, animationTarget, duration, setDisplayValue, () =>
			setAnimationTarget(null)
		)
	}, [animationTarget, duration])

	return displayValue
}
