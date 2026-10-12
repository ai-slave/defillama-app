import { DisclosureChevron } from '~/ui/DisclosureChevron'
import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'
import { StatusDot } from '~/ui/StatusBadge'
import { formatVerified } from '../format'
import { RiskCallout } from '../primitives/RiskCallout'
import type { DriftEntry, Freshness } from '../types'

// Relative time depends on the wall clock, so SSR renders the absolute date and swaps to
// "Updated Nd ago" after mount — no hydration mismatch.
function tsToIso(tsSec: number): string {
	return new Date(tsSec * 1000).toISOString()
}

function olderRun(a?: string, b?: string): string | undefined {
	if (!a) return b
	if (!b) return a
	return Date.parse(a) <= Date.parse(b) ? a : b
}

// Drift is protocol-level, inherited per-vault → phrase the banner as protocol-wide.
function DriftBanner({ entries, protocolId }: { entries: Array<DriftEntry>; protocolId: string }) {
	if (entries.length === 0) return null
	return (
		<RiskCallout as="details">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-2 label-md text-(--yield-warning-text)">
				<span className="flex items-center gap-1.5">
					<Icon name="alert-triangle" className="size-4" />
					{`${entries.length} onchain ${entries.length === 1 ? 'change' : 'changes'} detected — affects all ${protocolId} vaults`}
				</span>
				<DisclosureChevron kind="section" size="sm" />
			</summary>
			<ul className="mt-2 space-y-2">
				{entries.map((d) => (
					<li key={d.id} className="body-sm text-secondary">
						<p className="text-primary">{d.notes}</p>
						<p className="mt-0.5 mono-sm text-secondary">
							expected {d.expected} → actual {d.actual}
						</p>
					</li>
				))}
			</ul>
		</RiskCallout>
	)
}

export function FreshnessFooter({
	freshness,
	protocolFreshness,
	protocolId,
	lastUpdatedTs = null,
	stale = false
}: {
	freshness: Freshness
	protocolFreshness: Freshness | null
	protocolId: string
	lastUpdatedTs?: number | null // per-vault tick (unix seconds) — "Updated Nd ago"
	stale?: boolean // true = this row dropped out of its protocol's latest run
}) {
	const lastRun = olderRun(freshness.last_run, protocolFreshness?.last_run)
	// drift / stale arrays may live on either; merge & dedupe by id
	const driftMap = new Map<string, DriftEntry>()
	for (const d of [...(freshness.drift ?? []), ...(protocolFreshness?.drift ?? [])]) driftMap.set(d.id, d)
	const staleMap = new Map<string, DriftEntry>()
	for (const s of [...(freshness.stale ?? []), ...(protocolFreshness?.stale ?? [])]) staleMap.set(s.id, s)
	const sources = freshness.sources ?? []

	// "Healthy" = no drift, no unreadable readings, AND this row was refreshed in the last run.
	const healthy = driftMap.size === 0 && staleMap.size === 0 && !stale
	const updatedLabel =
		lastUpdatedTs != null ? (
			<RelativeTime value={lastUpdatedTs} input="seconds" prefix="Updated" />
		) : (
			`Last verified ${formatVerified(lastRun)}`
		)

	return (
		<div className="flex flex-col gap-2 body-sm text-secondary">
			<DriftBanner entries={[...driftMap.values()]} protocolId={protocolId} />
			{stale ? (
				<p className="flex items-start gap-1.5 body-sm text-(--yield-warning-text)">
					<span className="flex h-lh shrink-0 items-center">
						<Icon name="alert-triangle" className="size-3.5" />
					</span>
					<span>
						This pool wasn&apos;t refreshed in the latest run — showing the last-known-good snapshot
						{lastUpdatedTs != null ? ` from ${formatVerified(tsToIso(lastUpdatedTs))}` : ''}.
					</span>
				</p>
			) : null}
			{staleMap.size > 0 ? (
				<p className="flex items-start gap-1.5 body-sm text-secondary">
					<span className="flex h-lh shrink-0 items-center">
						<Icon name="clock" className="size-3.5" />
					</span>
					<span>
						{staleMap.size} reading{staleMap.size === 1 ? '' : 's'} could not be refreshed this run.
					</span>
				</p>
			) : null}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
				<span className="flex items-center gap-1.5">
					<StatusDot status={healthy ? 'good' : 'caution'} pulse={healthy} />
					{updatedLabel}
				</span>
				{sources.length > 0 ? (
					<span className="flex flex-wrap items-center gap-1.5">
						<span>Sources:</span>
						{sources.map((s) => (
							<span key={s.endpoint} className="mono-sm text-tertiary">
								{s.endpoint}
							</span>
						))}
					</span>
				) : null}
			</div>
		</div>
	)
}
