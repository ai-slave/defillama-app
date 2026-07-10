import { useEffect, useState } from 'react'
import { Icon } from '~/components/Icon'
import { formatVerified, relativeTimeFromTs } from '../format'
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
function DriftBanner({ entries, protocolId }: { entries: DriftEntry[]; protocolId: string }) {
	if (!entries.length) return null
	return (
		<details className="group rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-(--warning)">
				<span className="flex items-center gap-1.5">
					<Icon name="alert-triangle" className="size-4" />
					{`${entries.length} on-chain ${entries.length === 1 ? 'change' : 'changes'} detected — affects all ${protocolId} vaults`}
				</span>
				<Icon name="chevron-down" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
			</summary>
			<ul className="mt-2 space-y-2">
				{entries.map((d) => (
					<li key={d.id} className="text-xs text-(--legacy-text-secondary)">
						<p className="text-(--legacy-text-primary)">{d.notes}</p>
						<p className="mt-0.5 font-mono text-[11px] text-(--legacy-text-secondary)">
							expected {d.expected} → actual {d.actual}
						</p>
					</li>
				))}
			</ul>
		</details>
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
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const updatedLabel =
		lastUpdatedTs != null
			? mounted
				? `Updated ${relativeTimeFromTs(lastUpdatedTs)}`
				: `Updated ${formatVerified(tsToIso(lastUpdatedTs))}`
			: `Last verified ${formatVerified(lastRun)}`

	return (
		<div className="flex flex-col gap-2">
			<DriftBanner entries={[...driftMap.values()]} protocolId={protocolId} />
			{stale ? (
				<p className="flex items-center gap-1.5 text-xs text-(--warning)">
					<Icon name="alert-triangle" className="size-3.5 shrink-0" />
					<span>
						This pool wasn&apos;t refreshed in the latest run — showing the last-known-good snapshot
						{lastUpdatedTs != null ? ` from ${formatVerified(tsToIso(lastUpdatedTs))}` : ''}.
					</span>
				</p>
			) : null}
			{staleMap.size ? (
				<p className="flex items-center gap-1.5 text-xs text-(--legacy-text-secondary)">
					<Icon name="clock" className="size-3.5" />
					{staleMap.size} reading{staleMap.size === 1 ? '' : 's'} could not be refreshed this run.
				</p>
			) : null}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-(--legacy-text-secondary)">
				<span className="flex items-center gap-1.5">
					<span aria-hidden className="relative flex size-2">
						{healthy ? (
							<span className="absolute inset-0 animate-ping rounded-full bg-(--success) opacity-40 motion-reduce:hidden" />
						) : null}
						<span className={`relative size-2 rounded-full ${healthy ? 'bg-(--success)' : 'bg-(--warning)'}`} />
					</span>
					{updatedLabel}
				</span>
				{sources.length ? (
					<span className="flex flex-wrap items-center gap-1.5">
						<span>Sources:</span>
						{sources.map((s) => (
							<span
								key={s.endpoint}
								className="rounded-sm bg-(--legacy-bg-main) px-1.5 py-0.5 font-mono text-[10px] text-(--legacy-text-secondary)"
							>
								{s.endpoint}
							</span>
						))}
					</span>
				) : null}
			</div>
		</div>
	)
}
