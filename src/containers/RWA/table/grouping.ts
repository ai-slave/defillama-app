import type { RWAOverviewDisplayRow } from '../api.types'
import { normalizeRwaAssetGroup } from '../assetGroup'
import { getRwaPlatforms } from '../grouping'
import { findBreakdownValue, getChainShares, mergeBreakdowns } from './chains'
import { RWA_CHANGE_PERIODS, sumValues, sumValuesWithPrior, type RWAValueWithPrior } from './change'
import { getRwaGroupMemberships, type RWAGroupBy, type RWAGroupMembership, type RWAGroupOptions } from './groupBy'
import {
	emptyRwaTableMetrics,
	getRwaCategoryLabels,
	RWA_FLAG_KEYS,
	RWA_GROUP_DISTINCT_KEYS,
	type RWAChanges,
	type RWAGroupDistinct,
	type RWAGroupDistinctKey,
	type RWAGroupFlags,
	type RWAGroupRow,
	type RWALeafRow,
	type RWATableMetrics,
	type RWATableRow
} from './rows'

/** One parent per group value, in first-seen order; the table sorts them. */
export function groupRwaRows(
	rows: Array<RWALeafRow>,
	groupBy: RWAGroupBy,
	options: RWAGroupOptions = {}
): Array<RWATableRow> {
	if (groupBy === 'none') return rows

	const groups = new Map<string, { membership: RWAGroupMembership; children: Array<RWALeafRow> }>()
	for (const row of rows) {
		for (const membership of getRwaGroupMemberships(row, groupBy, options)) {
			const child = membership.chain ? sliceRwaLeafRowToChain(row, membership.chain) : row
			const group = groups.get(membership.key)
			if (group) group.children.push(child)
			else groups.set(membership.key, { membership, children: [child] })
		}
	}

	const out: Array<RWAGroupRow> = []
	for (const { membership, children } of groups.values()) {
		out.push({
			kind: 'group',
			id: `${groupBy}:${membership.key}`,
			label: membership.label,
			href: membership.href,
			icon: membership.icon,
			period: children[0].period,
			metrics: aggregateRwaGroupMetrics(children),
			distinct: collectRwaGroupDistinct(children),
			flags: tallyRwaGroupFlags(children),
			children
		})
	}
	return out
}

/**
 * The part of an asset on one chain. The series is per asset, so the slice's prior is the asset's prior times
 * the chain's share of today's value: exact for a single-chain asset, approximate for a multi-chain one.
 */
export function sliceRwaLeafRowToChain(row: RWALeafRow, chain: string): RWALeafRow {
	const activeMcap = findBreakdownValue(row.breakdowns.activeMcap, chain)
	const onChainMcap = findBreakdownValue(row.breakdowns.onChainMcap, chain)
	const defiActiveTvl = findBreakdownValue(row.breakdowns.defiActiveTvlByChain, chain)
	const chains = row.metrics.chains.filter((share) => share.chain === chain)
	const slice = { activeMcap, onChainMcap, defiActiveTvl }
	const change = Object.fromEntries(
		RWA_CHANGE_PERIODS.map((period) => [
			period,
			Object.fromEntries(
				(['activeMcap', 'onChainMcap', 'defiActiveTvl'] as const).map((metric) => [
					metric,
					splitPriorByShare(row.metrics.change[period][metric], row.metrics[metric], slice[metric])
				])
			)
		])
	) as RWAChanges

	return {
		kind: 'leaf',
		id: `${row.id}@${chain}`,
		asset: row.asset,
		chainScope: chain,
		period: row.period,
		metrics: {
			...emptyRwaTableMetrics(),
			activeMcap,
			onChainMcap,
			defiActiveTvl,
			change,
			netFlow7d: getChainFlow(row, '7d', chain),
			netFlow30d: getChainFlow(row, '30d', chain),
			price: row.metrics.price,
			chains,
			assetCount: 1,
			issuerCount: row.metrics.issuerCount,
			chainCount: chains.length
		},
		breakdowns: {
			activeMcap: activeMcap == null ? null : [[chain, activeMcap]],
			onChainMcap: onChainMcap == null ? null : [[chain, onChainMcap]],
			defiActiveTvl: null,
			defiActiveTvlByChain: defiActiveTvl == null ? [] : [[chain, defiActiveTvl]]
		},
		flows: row.flows
	}
}

export function aggregateRwaGroupMetrics(children: Array<RWALeafRow>): RWATableMetrics {
	const metrics = children.map((child) => child.metrics)
	const chains = getChainShares(mergeBreakdowns(children.map((child) => child.breakdowns.onChainMcap)))
	const issuers = new Set<string>()
	for (const child of children) {
		if (child.asset.issuer) issuers.add(child.asset.issuer)
	}

	return {
		activeMcap: sumValues(metrics.map((m) => m.activeMcap)),
		onChainMcap: sumValues(metrics.map((m) => m.onChainMcap)),
		defiActiveTvl: sumValues(metrics.map((m) => m.defiActiveTvl)),
		change: Object.fromEntries(
			RWA_CHANGE_PERIODS.map((period) => [
				period,
				{
					activeMcap: sumValuesWithPrior(metrics.map((m) => m.change[period].activeMcap)),
					onChainMcap: sumValuesWithPrior(metrics.map((m) => m.change[period].onChainMcap)),
					defiActiveTvl: sumValuesWithPrior(metrics.map((m) => m.change[period].defiActiveTvl))
				}
			])
		) as RWAChanges,
		netFlow7d: sumValues(metrics.map((m) => m.netFlow7d)),
		netFlow30d: sumValues(metrics.map((m) => m.netFlow30d)),
		price: null,
		priceChange24h: null,
		openInterest: sumValues(metrics.map((m) => m.openInterest)),
		openInterestChange24h: sumValuesWithPrior(metrics.map((m) => m.openInterestChange24h)),
		volume24h: sumValues(metrics.map((m) => m.volume24h)),
		volume7d: sumValues(metrics.map((m) => m.volume7d)),
		volume30d: sumValues(metrics.map((m) => m.volume30d)),
		fundingApr: weightedByOpenInterest(metrics, (m) => m.fundingApr),
		fundingRate: null,
		fundingIntervalHours: null,
		premium: weightedByOpenInterest(metrics, (m) => m.premium),
		maxLeverage: maxValue(metrics.map((m) => m.maxLeverage)),
		protocolFees24h: sumValues(metrics.map((m) => m.protocolFees24h)),
		chains,
		assetCount: children.length,
		issuerCount: issuers.size,
		chainCount: chains.length
	}
}

const DISTINCT_PICKS: Record<RWAGroupDistinctKey, (asset: RWAOverviewDisplayRow) => Array<string | null>> = {
	assetGroup: (asset) => [normalizeRwaAssetGroup(asset.assetGroup)],
	venueType: (asset) => [asset.kind === 'perps' ? asset.venueType : null],
	platform: (asset) => getRwaPlatforms(asset.parentPlatform),
	category: (asset) => getRwaCategoryLabels(asset),
	assetClass: (asset) => asset.assetClass ?? [],
	accessModel: (asset) => [asset.accessModel],
	type: (asset) => [asset.type],
	rwaClassification: (asset) => [asset.rwaClassification],
	issuer: (asset) => [asset.issuer]
}

export function collectRwaGroupDistinct(children: Array<RWALeafRow>): RWAGroupDistinct {
	const out = {} as RWAGroupDistinct
	for (const key of RWA_GROUP_DISTINCT_KEYS) {
		const values: Array<string> = []
		for (const child of children) {
			for (const value of DISTINCT_PICKS[key](child.asset)) {
				if (value && !values.includes(value)) values.push(value)
			}
		}
		out[key] = values
	}
	return out
}

/** A child without an answer counts in neither number. */
export function tallyRwaGroupFlags(children: Array<RWALeafRow>): RWAGroupFlags {
	const out = {} as RWAGroupFlags
	for (const key of RWA_FLAG_KEYS) {
		let yes = 0
		let known = 0
		for (const child of children) {
			const value = child.asset[key]
			if (value == null) continue
			known += 1
			if (value) yes += 1
		}
		out[key] = { yes, known }
	}
	return out
}

function getChainFlow(row: RWALeafRow, window: '7d' | '30d', chain: string): number | null {
	const summary = row.flows[window]?.byChain[chain]
	return summary?.status === 'measured' ? summary.flow : null
}

/** Rates weighted by open interest. */
function weightedByOpenInterest(
	metrics: Array<RWATableMetrics>,
	pick: (m: RWATableMetrics) => number | null
): number | null {
	let weighted = 0
	let weight = 0
	for (const m of metrics) {
		const value = pick(m)
		if (value == null || m.openInterest == null || m.openInterest <= 0) continue
		weighted += value * m.openInterest
		weight += m.openInterest
	}
	return weight > 0 ? weighted / weight : null
}

function maxValue(values: Array<number | null>): number | null {
	let max: number | null = null
	for (const value of values) {
		if (value != null && (max == null || value > max)) max = value
	}
	return max
}

function splitPriorByShare(
	whole: RWAValueWithPrior,
	wholeCurrent: number | null,
	sliceCurrent: number | null
): RWAValueWithPrior {
	if (
		sliceCurrent == null ||
		whole.current == null ||
		whole.prior == null ||
		wholeCurrent == null ||
		wholeCurrent <= 0
	) {
		return { current: null, prior: null }
	}
	return { current: sliceCurrent, prior: whole.prior * (sliceCurrent / wholeCurrent) }
}
