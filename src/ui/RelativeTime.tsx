import { useEffect, useState } from 'react'
import { formatDate, formatDateTime, formatRelativeTime, type TimestampInput } from '~/utils/dateFormat'

type RelativeTimeProps = {
	value: string | number | Date | null | undefined
	input?: TimestampInput
	prefix?: string
	/** Shown once the time has passed, for scheduled times where "ago" reads wrong. */
	pastLabel?: string
	fallback?: string
	className?: string
}

/** Hydration-safe freshness label with a ticking relative value and an exact timestamp tooltip. */
export function RelativeTime({ value, input, prefix, pastLabel, fallback = '-', className }: RelativeTimeProps) {
	const [now, setNow] = useState<Date | null>(null)

	useEffect(() => {
		// The clock starts on the client only: rendering a time during SSR would not match hydration.
		// oxlint-disable-next-line react/set-state-in-effect -- see above
		setNow(new Date())
		const timer = window.setInterval(() => setNow(new Date()), 60_000)
		return () => window.clearInterval(timer)
	}, [])

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
				? formatRelativeTime(value, { input, now, pastLabel })
				: null
			: formatRelativeTime(value, { now, pastLabel })
		: null
	const label = relative ?? absolute ?? fallback

	return (
		<span className={className} title={exact ?? undefined}>
			{prefix ? `${prefix} ${label}` : label}
		</span>
	)
}
