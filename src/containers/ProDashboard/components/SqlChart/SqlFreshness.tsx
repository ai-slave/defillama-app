import { useNowSeconds } from '~/hooks/useNowSeconds'
import { type Status, StatusDot } from '~/ui/StatusBadge'
import { formatDateTime } from '~/utils/dateFormat'

const FRESHNESS_YELLOW_MS = 24 * 60 * 60 * 1000
const FRESHNESS_RED_MS = 48 * 60 * 60 * 1000

function freshness(iso: string, now: number): { status: Status; label: string } {
	const computed = new Date(iso).getTime()
	if (!Number.isFinite(computed)) return { status: 'bad', label: 'Unknown data age' }
	const age = now - computed
	if (age < FRESHNESS_YELLOW_MS) return { status: 'good', label: 'Data is fresh (updated within 24h)' }
	if (age < FRESHNESS_RED_MS) return { status: 'caution', label: 'Data is older than 24h' }
	return { status: 'bad', label: 'Data is older than 48h' }
}

function timeAgo(iso: string, now: number): string {
	const then = new Date(iso).getTime()
	if (!Number.isFinite(then)) return ''
	const secs = Math.max(0, Math.floor((now - then) / 1000))
	if (secs < 60) return 'just now'
	const mins = Math.floor(secs / 60)
	if (mins < 60) return `${mins}min ago`
	const hours = Math.floor(mins / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.floor(hours / 24)
	if (days < 30) return `${days}d ago`
	const months = Math.floor(days / 30)
	if (months < 12) return `${months}mo ago`
	return `${Math.floor(months / 12)}y ago`
}

export function SqlFreshness({ computedAt }: { computedAt: string }) {
	const nowSeconds = useNowSeconds(0)
	const status = nowSeconds === 0 ? null : freshness(computedAt, nowSeconds * 1000)
	return (
		<span className="flex items-center gap-1.5 body-sm text-tertiary" title={status?.label}>
			{status ? <StatusDot status={status.status} label={status.label} /> : null}
			Updated{' '}
			{nowSeconds === 0
				? (formatDateTime(computedAt, { timeZone: 'UTC' }) ?? '-')
				: timeAgo(computedAt, nowSeconds * 1000)}
		</span>
	)
}
