import { formatDate } from '~/utils/dateFormat'
import { formatPercent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS } from '~/utils/numberFormat'
import type { KpkExcessWindow, KpkMandateClient, KpkMandatePerf, KpkMandates, KpkMandateWindow } from './api'
import { KPK_PERCENT_OPTIONS, PROSE_DUST_M, usdFromMillions, usdSignedFromMillions, type FooterRow } from './ui'

export function deployedTitle(client: KpkMandateClient): string | undefined {
	if (client.deployedUsd == null || client.yieldAum == null) return undefined
	const idle = client.idleUsd ?? 0
	const workingOps = (client.opsUsd ?? 0) - idle
	const legs: Array<string> = []
	if ((client.defiUsd ?? 0) > PROSE_DUST_M) legs.push(`${usdFromMillions(client.defiUsd)} in defi positions`)
	if (workingOps > PROSE_DUST_M) legs.push(`${usdFromMillions(workingOps)} in ops positions`)
	let out = `${usdFromMillions(client.deployedUsd)} of ${usdFromMillions(client.yieldAum)} deployed`
	if (legs.length > 0) out += ` — ${legs.join(' and ')}`
	if (idle > PROSE_DUST_M) out += `, with ${usdFromMillions(idle)} sitting idle`
	return out
}

export function rateBasisTitle(window: KpkMandateWindow): string | undefined {
	if (window.realized === undefined) return undefined
	if (!window.realized) {
		return 'Spot reading: a trailing mean applied to the latest balances. No per-position history covers this window.'
	}
	const balance = window.avgBalance == null ? '' : ` on a mean balance of ${usdFromMillions(window.avgBalance)}`
	const spot =
		window.spot?.apy == null
			? ''
			: ` The spot reading on the latest balances is ${formatPercent(window.spot.apy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}.`
	return `Earned: money-weighted across every priced position-day in the window${balance}.${spot}`
}

export function performanceEarnedTitle(
	perf: KpkMandatePerf | undefined,
	window: KpkExcessWindow | null | undefined
): string | undefined {
	if (!perf || !window || perf.earned == null || perf.benchEarned == null || perf.avgBalance == null) return undefined
	const from = formatDate(window.from) ?? window.from
	const to = formatDate(window.to) ?? window.to
	return `Window ${from} – ${to} (${window.days} days). ${perf.denom} earned ${usdFromMillions(
		perf.earned
	)} against ${usdFromMillions(perf.benchEarned)} at benchmark, on a mean balance of ${usdFromMillions(perf.avgBalance)}.`
}

/**
 * Two ways a client can be missing from the snapshot and still be real: the store
 * has not caught up, or it wound down inside the earned window.
 */
export function missingAumTitle(
	client: KpkMandateClient,
	asOf: string | null | undefined,
	yieldAsOf: string | null | undefined
): string | undefined {
	const snapshot = (asOf && formatDate(asOf)) ?? 'latest'
	if (client.yieldAum != null) {
		return `Not in the ${snapshot} treasury snapshot yet; ${usdFromMillions(client.yieldAum)} as of ${
			(yieldAsOf && formatDate(yieldAsOf)) ?? 'the positions report'
		}`
	}
	if (client.excessAvgBalance != null) {
		return `Not in the ${snapshot} treasury snapshot — held a mean ${usdFromMillions(
			client.excessAvgBalance
		)} during the earned-return window`
	}
	return undefined
}

/**
 * A wound-down mandate is off the table but still inside the headline excess, so
 * it gets its own row above the total. The share total is what the listed shares
 * actually add up to, not a nominal 100%.
 */
export function clientFooterRows(data: KpkMandates): Array<FooterRow> {
	const rows: Array<FooterRow> = []
	const inactive = data.inactive
	if (inactive) {
		rows.push({
			muted: true,
			title: `${inactive.names.join(', ')} held nothing in the ${
				(data.asOf && formatDate(data.asOf)) ?? 'latest'
			} snapshot, so they are not listed above.`,
			cells: {
				name: `Plus ${inactive.count} mandate${inactive.count > 1 ? 's' : ''} with no current balance`,
				excess: usdSignedFromMillions(inactive.excess)
			}
		})
	}
	let sharesTotal = 0
	for (const client of data.clients) sharesTotal += client.share ?? 0
	rows.push({
		cells: {
			name: 'Total',
			aum: usdFromMillions(data.totals.aum),
			share: formatPercent(sharesTotal, KPK_PERCENT_OPTIONS) ?? '—',
			deployedPct: formatPercent(data.totals.weightedDeployedPct, KPK_PERCENT_OPTIONS) ?? '—',
			excess: usdSignedFromMillions(data.totals.excess)
		}
	})
	return rows
}
