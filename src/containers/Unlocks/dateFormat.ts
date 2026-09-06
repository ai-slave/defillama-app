const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function pad(value: number): string {
	return String(value).padStart(2, '0')
}

/** Preserves the compact UTC label used by unlock schedules and the legacy calendar page. */
export function formatUnlockDate(timestampSeconds: number): string {
	const date = new Date(timestampSeconds * 1000)
	return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export function formatUnlockTime(timestampSeconds: number): string {
	const date = new Date(timestampSeconds * 1000)
	return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}
