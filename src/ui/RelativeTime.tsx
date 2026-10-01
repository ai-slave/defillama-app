import { useNowSeconds } from '~/hooks/useNowSeconds'
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

/** Freshness label that ticks each minute, with an exact timestamp tooltip. The server and the hydrating client
    measure it from the page clock, then it follows the visitor's clock. */
export function RelativeTime({ value, input, prefix, pastLabel, fallback = '-', className }: RelativeTimeProps) {
	const now = new Date(useNowSeconds(undefined, 60_000) * 1000)

	const exact =
		typeof value === 'number'
			? input
				? formatDateTime(value, { input, timeZone: 'UTC' })
				: null
			: formatDateTime(value, { timeZone: 'UTC' })
	const absolute = typeof value === 'number' ? (input ? formatDate(value, { input }) : null) : formatDate(value)
	const relative =
		typeof value === 'number'
			? input
				? formatRelativeTime(value, { input, now, pastLabel })
				: null
			: formatRelativeTime(value, { now, pastLabel })
	const label = relative ?? absolute ?? fallback

	return (
		<span className={className} title={exact ?? undefined}>
			{prefix ? `${prefix} ${label}` : label}
		</span>
	)
}
