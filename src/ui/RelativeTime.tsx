import { useEffect, useState } from 'react'
import { formatDate, formatDateTime, formatRelativeTime, type TimestampInput } from '~/utils/dateFormat'

type RelativeTimeProps = {
	value: string | number | Date | null | undefined
	input?: TimestampInput
	prefix?: string
	fallback?: string
	refreshIntervalMs?: number
	className?: string
}

/** Hydration-safe freshness label with a ticking relative value and an exact timestamp tooltip. */
export function RelativeTime({
	value,
	input,
	prefix,
	fallback = '-',
	refreshIntervalMs = 60_000,
	className
}: RelativeTimeProps) {
	const [now, setNow] = useState<Date | null>(null)

	useEffect(() => {
		// The clock starts on the client only: rendering a time during SSR would not match hydration.
		// oxlint-disable-next-line react/set-state-in-effect -- see above
		setNow(new Date())
		const timer = window.setInterval(() => setNow(new Date()), refreshIntervalMs)
		return () => window.clearInterval(timer)
	}, [refreshIntervalMs])

	const exact =
		typeof value === 'number'
			? input
				? formatDateTime(value, { input, timeZone: 'UTC' })
				: null
			: formatDateTime(value, { timeZone: 'UTC' })
	const absolute = typeof value === 'number' ? (input ? formatDate(value, { input }) : null) : formatDate(value)
	const relative = now
		? typeof value === 'number'
			? input
				? formatRelativeTime(value, { input, now })
				: null
			: formatRelativeTime(value, { now })
		: null
	const label = relative ?? absolute ?? fallback

	return (
		<span className={className} title={exact ?? undefined}>
			{prefix ? `${prefix} ${label}` : label}
		</span>
	)
}
