/**
 * Oracle membership and TVS read models.
 *
 * - Membership and measurement are separate sources. `/v2/metrics/oracle` `oracles` owns global membership and order,
 *   `protocolsByOracleChain` owns chain membership and secured-protocol counts, and `oraclesTVS` supplies measurements
 *   only. `chainsByOracle` may order chain links but never adds or removes members.
 * - In a successful current snapshot, an omitted known member contributes zero without erasing measured peers, an
 *   explicit zero stays zero, and a known provider with no current measurements totals zero. A whole-source failure
 *   is unavailable.
 * - Historical dominance divides each provider's available measurement by the available total at that timestamp.
 *   A provider absent from every successful selected section is a gap.
 * - When any successful selected base or extra section has a point, omitted successful sections contribute zero at that
 *   timestamp. A failed selected extra section is excluded and disclosed, never treated as zero.
 * - Oracle identity does not depend on measurement availability, so a metrics outage never relabels ordinary protocol
 *   TVL as TVS.
 * - A chain-qualified recognized extra-TVL key contributes its exact value; when it is the member's only selected-chain
 *   measurement, the member's base contribution is zero.
 * - `/lite/protocols2` only enriches exact member names with protocol metadata.
 */

import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { toStrikeTvl } from '~/containers/ProtocolRankings/utils'
import { TVL_SETTINGS_KEYS_SET } from '~/contexts/LocalStorage'
import { slug } from '~/utils'
import {
	fetchOracleMetrics,
	fetchOracleProtocolBreakdownChart,
	fetchOracleProtocolChart,
	fetchOracleProtocolChainBreakdownChart,
	fetchOracleChainProtocolBreakdownChart
} from './api'
import type { IOracleMetrics } from './api.types'
import type {
	OracleChartData,
	OracleOverviewPageData,
	OraclesByChainPageData,
	OracleProtocolWithBreakdown,
	OracleTableDataRow
} from './types'

function isExtraTvlKey(value: string): boolean {
	return TVL_SETTINGS_KEYS_SET.has(value) || value === 'dcAndLsOverlap'
}

function resolveCanonicalName(value: string, options: Array<string>): string | null {
	const normalizedValue = slug(value)

	for (const option of options) {
		if (option === value) {
			return option
		}

		if (slug(option) === normalizedValue) {
			return option
		}
	}

	return null
}

function getOracleChains(metrics: IOracleMetrics, oracle: string): Array<string> {
	const membersByChain = metrics.protocolsByOracleChain[oracle]
	if (!membersByChain) return []

	const chains: Array<string> = []
	for (const chain of metrics.chainsByOracle[oracle] ?? []) {
		if (membersByChain[chain] !== undefined) chains.push(chain)
	}
	for (const chain in membersByChain) {
		if (!chains.includes(chain)) chains.push(chain)
	}
	return chains
}

function getAllChains(protocolsByOracleChain: IOracleMetrics['protocolsByOracleChain']): Array<string> {
	const allChains = new Set<string>()
	for (const oracle in protocolsByOracleChain) {
		const membersByChain = protocolsByOracleChain[oracle]
		if (!membersByChain) continue
		for (const chain in membersByChain) allChains.add(chain)
	}
	return Array.from(allChains)
}

function getOracleExtraTvlSuffix(breakdownKey: string): string | null {
	if (isExtraTvlKey(breakdownKey)) return breakdownKey

	for (const extraKey of TVL_SETTINGS_KEYS_SET) {
		if (breakdownKey.endsWith(`-${extraKey}`)) return extraKey
	}

	return breakdownKey.endsWith('-dcAndLsOverlap') ? 'dcAndLsOverlap' : null
}

function aggregateTvlFromBreakdown({
	data,
	chain
}: {
	data: Record<string, number> | undefined
	chain: string | null
}): { tvl: number | null; extraTvl: Record<string, number> } {
	let tvl: number | null = null
	const extraTvl: Record<string, number> = {}
	let hasChainMeasurement = false

	if (!data) {
		return { tvl: null, extraTvl }
	}

	for (const breakdownKey in data) {
		const value = data[breakdownKey]
		if (value === undefined) continue
		if (isExtraTvlKey(breakdownKey)) {
			continue
		}

		if (chain) {
			if (breakdownKey === chain) {
				hasChainMeasurement = true
				tvl = (tvl ?? 0) + value
				continue
			}

			const metricPrefix = `${chain}-`
			if (!breakdownKey.startsWith(metricPrefix)) continue
			const metricName = breakdownKey.slice(metricPrefix.length)
			if (!metricName || !isExtraTvlKey(metricName)) continue
			hasChainMeasurement = true
			extraTvl[metricName] = (extraTvl[metricName] ?? 0) + value
			continue
		}

		const metricName = getOracleExtraTvlSuffix(breakdownKey)
		if (metricName) {
			extraTvl[metricName] = (extraTvl[metricName] ?? 0) + value
		} else {
			// A hyphen is valid inside a base chain name (for example, X-Layer). Only
			// recognized metric suffixes split an Oracle breakdown key.
			tvl = (tvl ?? 0) + value
		}
	}

	return { tvl: chain && hasChainMeasurement && tvl === null ? 0 : tvl, extraTvl }
}

function buildOracleProtocolBreakdown({
	protocolOracleData,
	chain
}: {
	protocolOracleData: Record<string, number> | undefined
	chain: string | null
}): { tvl: number | null; extraTvl: Record<string, number> } {
	return aggregateTvlFromBreakdown({
		data: protocolOracleData,
		chain
	})
}

function aggregateOracleMembers({
	memberNames,
	oracleProtocols,
	chain
}: {
	memberNames: ReadonlyArray<string>
	oracleProtocols: Record<string, Record<string, number>>
	chain: string | null
}): { tvl: number | null; extraTvl: Record<string, number> } {
	if (memberNames.length === 0) return { tvl: null, extraTvl: {} }

	let tvl = 0
	const extraTvl: Record<string, number> = {}

	for (const protocolName of memberNames) {
		const protocolBreakdown = aggregateTvlFromBreakdown({ data: oracleProtocols[protocolName], chain })
		if (protocolBreakdown.tvl !== null) tvl += protocolBreakdown.tvl
		for (const extraKey in protocolBreakdown.extraTvl) {
			const extraValue = protocolBreakdown.extraTvl[extraKey]
			if (extraValue === undefined) continue
			extraTvl[extraKey] = (extraTvl[extraKey] ?? 0) + extraValue
		}
	}

	return { tvl, extraTvl }
}

// - /oracles, /oracles/chain/:chain
export async function getOraclesListPageData({
	chain = null
}: {
	chain?: string | null
} = {}): Promise<OraclesByChainPageData | null> {
	const metrics = await fetchOracleMetrics()

	const oracleProtocolNamesByOracle = metrics.oracles
	const protocolsByOracleChain = metrics.protocolsByOracleChain
	const oraclesTVS = metrics.oraclesTVS
	const allChains = getAllChains(protocolsByOracleChain)
	const canonicalChain = chain ? resolveCanonicalName(chain, allChains) : null

	if (chain && !canonicalChain) {
		return null
	}

	const chartData: OracleChartData = canonicalChain
		? await fetchOracleChainProtocolBreakdownChart({ chain: canonicalChain })
		: await fetchOracleProtocolBreakdownChart()
	const latestTvlByChain: Record<string, number> = {}

	const tableData: Array<OracleTableDataRow> = []
	for (const oracle in oracleProtocolNamesByOracle) {
		const canonicalMembers = oracleProtocolNamesByOracle[oracle]
		if (!canonicalMembers) continue
		const chains = getOracleChains(metrics, oracle)
		const memberNames = canonicalChain ? protocolsByOracleChain[oracle]?.[canonicalChain] : canonicalMembers
		if (!memberNames) continue

		const oracleProtocols = oraclesTVS[oracle]
		if (!oracleProtocols) throw new Error(`Oracle metrics is missing TVS measurements for ${oracle}`)
		const { tvl, extraTvl } = aggregateOracleMembers({
			memberNames,
			oracleProtocols,
			chain: canonicalChain
		})
		for (const protocolName of canonicalMembers) {
			const protocolBreakdown = oracleProtocols[protocolName]
			if (!protocolBreakdown) continue
			for (const chainOrExtraTvlKey in protocolBreakdown) {
				const value = protocolBreakdown[chainOrExtraTvlKey]
				if (value === undefined) continue
				if (getOracleExtraTvlSuffix(chainOrExtraTvlKey)) continue
				latestTvlByChain[chainOrExtraTvlKey] = (latestTvlByChain[chainOrExtraTvlKey] ?? 0) + value
			}
		}
		tableData.push({
			name: oracle,
			tvl,
			extraTvl,
			protocolsSecured: memberNames.length,
			chains
		})
	}
	tableData.sort((a, b) => {
		if (a.tvl === null) return b.tvl === null ? 0 : 1
		if (b.tvl === null) return -1
		return b.tvl - a.tvl
	})
	const oracles = tableData.map((row) => row.name)
	const oraclesColors: Record<string, string> = {
		Others: OTHERS_COLOR
	}
	for (const [index, oracleName] of oracles.entries()) {
		oraclesColors[oracleName] = chartColor(index)
	}

	const uniqueChains = getAllChains(protocolsByOracleChain).sort(
		(a, b) => (latestTvlByChain[b] ?? 0) - (latestTvlByChain[a] ?? 0)
	)
	const chainLinks = [{ label: 'All', to: `/oracles` }].concat(
		uniqueChains.map((c) => ({ label: c, to: `/oracles/chain/${slug(c)}` }))
	)

	return {
		chain: canonicalChain,
		oracles,
		chainLinks,
		tableData,
		chartData,
		oraclesColors
	}
}

// - /oracles/:oracle, /oracles/:oracle/:chain
export async function getOracleDetailPageData({
	oracle,
	chain = null
}: {
	oracle: string
	chain?: string | null
}): Promise<OracleOverviewPageData | null> {
	const metrics = await fetchOracleMetrics()
	const oracleProtocolNamesByOracle = metrics.oracles
	const oraclesTVS = metrics.oraclesTVS

	const oracleNames = Object.keys(oracleProtocolNamesByOracle)
	const canonicalOracle = resolveCanonicalName(oracle, oracleNames)
	if (!canonicalOracle) {
		return null
	}

	const availableChains = getOracleChains(metrics, canonicalOracle)
	const canonicalChain = chain ? resolveCanonicalName(chain, availableChains) : null
	if (chain && !canonicalChain) {
		return null
	}

	let chartData: OracleChartData = []
	let protocolsResponse: Awaited<ReturnType<typeof fetchProtocols>>

	if (canonicalChain) {
		const [fetchedOracleChainBreakdown, fetchedProtocolsResponse] = await Promise.all([
			fetchOracleProtocolChainBreakdownChart({ protocol: canonicalOracle }),
			fetchProtocols()
		])
		protocolsResponse = fetchedProtocolsResponse
		chartData = []
		for (const dayData of fetchedOracleChainBreakdown) {
			const chainValue = dayData[canonicalChain]
			if (typeof chainValue !== 'number') continue
			chartData.push({ timestamp: dayData.timestamp, [canonicalOracle]: chainValue })
		}
	} else {
		const [oracleChart, fetchedProtocolsResponse] = await Promise.all([
			fetchOracleProtocolChart({ protocol: canonicalOracle }),
			fetchProtocols()
		])
		protocolsResponse = fetchedProtocolsResponse
		chartData = oracleChart.map(([timestamp, value]) => ({
			timestamp,
			[canonicalOracle]: value
		}))
	}

	const oracleProtocols = oraclesTVS[canonicalOracle]
	if (!oracleProtocols) throw new Error(`Oracle metrics is missing TVS measurements for ${canonicalOracle}`)
	const protocolsByName = new Map<string, ProtocolLite>()
	for (const protocol of protocolsResponse.protocols) protocolsByName.set(protocol.name, protocol)
	const parentProtocolsById = new Map<string, (typeof protocolsResponse.parentProtocols)[number]>()
	for (const parent of protocolsResponse.parentProtocols) parentProtocolsById.set(parent.id, parent)
	const orderedOracleProtocolNames = canonicalChain
		? metrics.protocolsByOracleChain[canonicalOracle]?.[canonicalChain]
		: oracleProtocolNamesByOracle[canonicalOracle]
	if (!orderedOracleProtocolNames) {
		throw new Error(
			`Oracle metrics is missing membership for ${canonicalOracle}${canonicalChain ? ` on ${canonicalChain}` : ''}`
		)
	}
	const { tvl, extraTvl } = aggregateOracleMembers({
		memberNames: orderedOracleProtocolNames,
		oracleProtocols,
		chain: canonicalChain
	})
	const protocolRowsByName = new Map<string, OracleProtocolWithBreakdown>()
	const parentIdByProtocolName = new Map<string, string>()
	const childRowsByParentId = new Map<string, Array<OracleProtocolWithBreakdown>>()
	for (const protocolName of orderedOracleProtocolNames) {
		// Oracle metrics owns membership. The lite response only enriches rows with public metadata;
		// without an exact name match there is no identity payload to render safely.
		const protocolData = protocolsByName.get(protocolName)
		if (!protocolData) continue

		const { tvl: protocolTvl, extraTvl: protocolExtraTvl } = buildOracleProtocolBreakdown({
			protocolOracleData: oracleProtocols[protocolName],
			chain: canonicalChain
		})

		const row: OracleProtocolWithBreakdown = {
			name: protocolData.name,
			logo: protocolData.logo,
			category: protocolData.category,
			tvl: protocolTvl ?? 0,
			extraTvl: protocolExtraTvl,
			strikeTvl: toStrikeTvl(protocolData, {
				liquidstaking: protocolExtraTvl.liquidstaking !== undefined,
				doublecounted: protocolExtraTvl.doublecounted !== undefined
			})
		}
		if (protocolData.deprecated) row.deprecated = true
		protocolRowsByName.set(protocolName, row)
		if (protocolData.parentProtocol && parentProtocolsById.has(protocolData.parentProtocol)) {
			parentIdByProtocolName.set(protocolName, protocolData.parentProtocol)
			const childRows = childRowsByParentId.get(protocolData.parentProtocol)
			if (childRows) childRows.push(row)
			else childRowsByParentId.set(protocolData.parentProtocol, [row])
		}
	}

	const protocolTableData: Array<OracleProtocolWithBreakdown> = []
	const emittedParentIds = new Set<string>()
	for (const protocolName of orderedOracleProtocolNames) {
		const row = protocolRowsByName.get(protocolName)
		if (!row) continue
		const parentId = parentIdByProtocolName.get(protocolName)
		const childRows = parentId ? childRowsByParentId.get(parentId) : undefined
		const parent = parentId ? parentProtocolsById.get(parentId) : undefined
		if (!parentId || !parent || !childRows || childRows.length < 2) {
			protocolTableData.push(row)
			continue
		}
		if (emittedParentIds.has(parentId)) continue
		emittedParentIds.add(parentId)

		let parentTvl = 0
		let parentCategory: string | null = childRows[0]?.category ?? null
		let parentStrikeTvl = false
		const parentExtraTvl: Record<string, number> = {}
		for (const child of childRows) {
			parentTvl += child.tvl ?? 0
			if (child.category !== parentCategory) parentCategory = null
			if (child.strikeTvl) parentStrikeTvl = true
			for (const extraKey in child.extraTvl) {
				const value = child.extraTvl[extraKey]
				if (value !== undefined) parentExtraTvl[extraKey] = (parentExtraTvl[extraKey] ?? 0) + value
			}
		}

		const parentRow: OracleProtocolWithBreakdown = {
			name: parent.name,
			logo: parent.logo,
			category: parentCategory,
			tvl: parentTvl,
			extraTvl: parentExtraTvl,
			strikeTvl: parentStrikeTvl,
			childProtocols: childRows
		}
		if (parent.deprecated) parentRow.deprecated = true
		protocolTableData.push(parentRow)
	}

	const chainLinks = [{ label: 'All', to: `/oracles/${slug(canonicalOracle)}` }].concat(
		availableChains.map((c) => ({ label: c, to: `/oracles/${slug(canonicalOracle)}/${slug(c)}` }))
	)

	return {
		chain: canonicalChain,
		chainLinks,
		oracle: canonicalOracle,
		tvl,
		extraTvl,
		protocolTableData,
		chartData
	}
}
