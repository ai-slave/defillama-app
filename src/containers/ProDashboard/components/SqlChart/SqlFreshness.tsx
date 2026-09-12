import { useNowSeconds } from '~/hooks/useNowSeconds'
import { formatDateTime } from '~/utils/dateFormat'

const FRESHNESS_YELLOW_MS = 24 * 60 * 60 * 1000
const FRESHNESS_RED_MS = 48 * 60 * 60 * 1000

function freshness(iso: string, now: number): { dot: string; label: string } {
	const computed = new Date(iso).getTime()
	if (!Number.isFinite(computed)) return { dot: 'bg-error', label: 'Unknown data age' }
	const age = now - computed
	if (age < FRESHNESS_YELLOW_MS) return { dot: 'bg-success', label: 'Data is fresh (updated within 24h)' }
	if (age < FRESHNESS_RED_MS) return { dot: 'bg-warning', label: 'Data is older than 24h' }
	return { dot: 'bg-error', label: 'Data is older than 48h' }
}

function timeAgo(iso: string, now: number): string {
	const then = new Date(iso).getTime()
	if (!Number.isFinite(then)) return ''
	const secs = Math.max(0, Math.floor((now - then) / 1000))
	if (secs < 60) return 'just now'
	const mins = Math.floor(secs / 60)
	if (mins < 60) return `${mins}m ago`
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
		<span className="flex items-center gap-1.5 text-xs text-pro-text-tertiary" title={status?.label}>
			{status ? <span aria-hidden className={`inline-block size-1.5 shrink-0 rounded-full ${status.dot}`} /> : null}
			Updated{' '}
			{nowSeconds === 0
				? (formatDateTime(computedAt, { timeZone: 'UTC' }) ?? '-')
				: timeAgo(computedAt, nowSeconds * 1000)}
		</span>
	)
}
