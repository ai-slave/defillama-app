/**
 * The LST directory read model.
 *
 * - One population feeds the headline totals, charts, table and exports.
 * - Core protocol histories are required. The LST-rate and Yields APY sources are optional enrichments: a failed one
 *   hides only its own table columns, and a successful empty one keeps the columns with empty cells.
 * - APY uses the pool whose symbol matches the LST-rate symbol exactly, else the largest eligible TVL pool.
 * - The canonical LST member slug is the identity across sources; never rebuild it from display names, which drops
 *   mixed-case names.
 * - Historical token balances sum every key containing `ETH`; current balances use the largest such key.
 */

import { prepareRuntimePieChartData } from '~/components/ECharts/PieChart/data'
import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import { slug } from '~/utils'
import { fetchEthPrice, fetchLsdRates, fetchProtocolBySlug, fetchYieldPools } from './api'
import type { ILsdRateApiItem } from './api.types'
import type { ILSTPeg, ILSTTokenRow, InflowsChartData, LSTHistoryRow, LSTOverviewProps } from './types'

const roundDate = (ts: number): number => Math.floor(ts / 86_400) * 86_400

function getETHValue(obj: Record<string, number>): number {
	let eth = 0
	for (const key in obj) {
		const value = obj[key]
		if (value === undefined) continue
		if (key.includes('ETH') && value > eth) {
			eth = value
		}
	}
	return eth
}

const EXCLUDED_PROTOCOLS = new Set(['StakeHound', 'Genius', 'SharedStake', 'VaultLayer'])

interface LSTMember {
	name: string
	protocolSlug: string
	deprecated: boolean
}

interface APYCandidate {
	apy: number | null
	tvlUsd: number | null
	exactSymbol: boolean
}

interface HistoricEntry {
	name: string
	date: number
	value: number
}

export async function getLSTPageData(snapshot: YieldsSnapshot | null): Promise<LSTOverviewProps> {
	const ratesRequest = fetchLsdRates().then(
		(data) => ({ available: true as const, data }),
		() => ({ available: false as const, data: [] })
	)
	const poolsRequest = snapshot
		? fetchYieldPools(snapshot).then(
				(data) => ({ available: true as const, data }),
				() => ({ available: false as const, data: [] })
			)
		: Promise.resolve({ available: false as const, data: [] })
	const [{ protocols }, poolsResult, ratesResult, ethPrice] = await Promise.all([
		fetchProtocols(),
		poolsRequest,
		ratesRequest,
		fetchEthPrice()
	])

	const members: Array<LSTMember> = []
	for (const protocol of protocols) {
		if (
			protocol.category === 'Liquid Staking' &&
			protocol.chains.includes('Ethereum') &&
			!EXCLUDED_PROTOCOLS.has(protocol.name)
		) {
			members.push({
				name: protocol.name,
				protocolSlug: slug(protocol.name),
				deprecated: protocol.deprecated === true
			})
		}
	}
	members.push({
		name: 'Crypto.com Liquid Staking',
		protocolSlug: 'crypto.com-liquid-staking',
		deprecated: false
	})

	const memberNameBySlug = new Map<string, string>()
	for (const member of members) {
		memberNameBySlug.set(member.protocolSlug, member.name)
	}
	memberNameBySlug.set('crypto.com-staked-eth', 'Crypto.com Liquid Staking')
	const chartData = await Promise.all(
		members.map(async (member) => ({ member, protocol: await fetchProtocolBySlug(member.protocolSlug) }))
	)

	// --- Beth: combine Ethereum + BSC ---
	const beth = chartData.find(({ member }) => member.protocolSlug === 'binance-staked-eth')?.protocol
	if (beth) {
		const combineBethChains = (tokensKey: 'tokens' | 'tokensInUsd') => {
			const bscByDate = new Map<number, Record<string, number>>()
			for (const entry of beth.chainTvls['BSC']?.[tokensKey] ?? []) {
				bscByDate.set(entry.date, entry.tokens)
			}
			const combined: Array<{ date: number; tokens: Record<string, number> }> = []
			for (const i of beth.chainTvls['Ethereum']?.[tokensKey] ?? []) {
				const bscTokens = bscByDate.get(i.date)
				const ethVal = i.tokens['ETH'] ?? i.tokens['WETH'] ?? 0
				const bscVal = bscTokens ? (bscTokens['ETH'] ?? bscTokens['WETH'] ?? 0) : 0
				combined.push({ date: i.date, tokens: { ETH: ethVal + bscVal } })
			}
			return combined
		}
		if (beth.chainTvls['Ethereum']) {
			beth.chainTvls['Ethereum'].tokens = combineBethChains('tokens')
			beth.chainTvls['Ethereum'].tokensInUsd = combineBethChains('tokensInUsd')
		}
	}

	const PRICE_DIFF_THRESHOLD = 0.01

	// --- Build historicData and group by date + name ---
	const historicByDate = new Map<number, Array<HistoricEntry>>()
	const historicByName = new Map<string, Array<HistoricEntry>>()

	for (const { member, protocol } of chartData) {
		const tokensArray =
			member.protocolSlug === 'crypto.com-liquid-staking'
				? protocol.chainTvls['Cronos']?.tokens
				: protocol.chainTvls['Ethereum']?.tokens

		if (!tokensArray) continue

		let prevDate = -1
		for (const t of tokensArray) {
			const date = roundDate(t.date)
			if (date === prevDate) continue
			prevDate = date

			let totalEthValue = 0
			for (const key in t.tokens) {
				const value = t.tokens[key]
				if (value !== undefined && key.includes('ETH')) {
					totalEthValue += value
				}
			}
			if (totalEthValue <= 0) continue

			const entry = { name: member.name, date, value: totalEthValue }

			const entriesForDate = historicByDate.get(date)
			if (entriesForDate) entriesForDate.push(entry)
			else historicByDate.set(date, [entry])

			const entriesForProtocol = historicByName.get(member.name)
			if (entriesForProtocol) entriesForProtocol.push(entry)
			else historicByName.set(member.name, [entry])
		}
	}

	// --- areaChartData (canonical absolute ETH values; selection determines the percentage denominator) ---
	const areaChartData: Array<LSTHistoryRow> = []
	const sortedHistoricEntries = Array.from(historicByDate.entries()).sort(([a], [b]) => a - b)
	for (const [date, dayData] of sortedHistoricEntries) {
		let data = dayData
		// dedupe on the 27th of august (lido duplicated)
		if (date === 1_630_022_400) {
			const seenNames = new Set<string>()
			data = []
			for (const item of dayData) {
				if (seenNames.has(item.name)) continue
				seenNames.add(item.name)
				data.push(item)
			}
		}

		const row: LSTHistoryRow = { date }
		let hasLido = false
		for (const item of data) {
			if (item.name === 'Lido') hasLido = true
			row[item.name] = item.value
		}
		// skip days after Dec 2020 that are missing lido data
		if (date > 1_608_321_600 && !hasLido) continue
		areaChartData.push(row)
	}

	// --- tokenTvls (current staking stats) ---
	const tokenTvls: Array<
		Pick<
			ILSTTokenRow,
			| 'name'
			| 'protocolSlug'
			| 'logo'
			| 'deprecated'
			| 'mcap'
			| 'stakedEth'
			| 'stakedEthInUsd'
			| 'stakedEthPctChange7d'
			| 'stakedEthPctChange30d'
		>
	> = []
	let stakedEthSum = 0
	let stakedEthInUsdSum: number | null = 0
	for (const { member, protocol } of chartData) {
		const p =
			member.protocolSlug === 'crypto.com-liquid-staking'
				? protocol.chainTvls['Cronos']
				: protocol.chainTvls['Ethereum']

		if (!p?.tokens.length) {
			continue
		}

		const lastTokenRecord = p.tokens.at(-1)
		if (!lastTokenRecord) continue
		const lastDate = lastTokenRecord.date
		const offset7d = roundDate(lastDate - 7 * 86_400)
		const offset30d = roundDate(lastDate - 30 * 86_400)

		const lastTokens = lastTokenRecord.tokens
		let lastTokensInUsd: Record<string, number> | null = null
		for (let index = p.tokensInUsd.length - 1; index >= 0; index--) {
			const record = p.tokensInUsd[index]
			if (!record) continue
			if (record.date === lastDate) {
				lastTokensInUsd = record.tokens
				break
			}
			if (record.date < lastDate) break
		}
		let lastTokens7d: Record<string, number> | null = null
		let lastTokens30d: Record<string, number> | null = null
		// The producer returns unique ascending timestamps, so only the newest 30 days can match.
		for (let index = p.tokens.length - 2; index >= 0; index--) {
			const item = p.tokens[index]
			if (!item || item.date < offset30d) break
			if (lastTokens7d == null && item.date === offset7d) {
				lastTokens7d = item.tokens
			} else if (lastTokens30d == null && item.date === offset30d) {
				lastTokens30d = item.tokens
			}
			if (lastTokens7d && lastTokens30d) break
		}

		const eth = getETHValue(lastTokens)
		const measuredEthInUsd = lastTokensInUsd ? getETHValue(lastTokensInUsd) : null
		const eth7d = lastTokens7d ? getETHValue(lastTokens7d) : null
		const eth30d = lastTokens30d ? getETHValue(lastTokens30d) : null

		let correctedEth = eth
		if (ethPrice != null && ethPrice > 0 && measuredEthInUsd) {
			const calculatedEth = measuredEthInUsd / ethPrice
			if (Math.abs(calculatedEth - eth) / eth > PRICE_DIFF_THRESHOLD) {
				correctedEth = calculatedEth
			}
		}
		const ethInUsd = measuredEthInUsd ?? (ethPrice != null && ethPrice > 0 ? correctedEth * ethPrice : null)

		if (correctedEth === 0) {
			continue
		}

		const tokenTvl = {
			name: member.name,
			protocolSlug: member.protocolSlug,
			logo: protocol.logo,
			deprecated: member.deprecated,
			mcap: protocol.mcap,
			stakedEth: correctedEth,
			stakedEthInUsd: ethInUsd,
			stakedEthPctChange7d: eth7d != null && eth7d > 0 ? ((correctedEth - eth7d) / eth7d) * 100 : null,
			stakedEthPctChange30d: eth30d != null && eth30d > 0 ? ((correctedEth - eth30d) / eth30d) * 100 : null
		}
		tokenTvls.push(tokenTvl)
		stakedEthSum += tokenTvl.stakedEth
		if (tokenTvl.stakedEthInUsd == null) stakedEthInUsdSum = null
		else if (stakedEthInUsdSum != null) stakedEthInUsdSum += tokenTvl.stakedEthInUsd
	}
	tokenTvls.sort((a, b) => b.stakedEth - a.stakedEth)

	const rebase = 'Rebase Token: Staking rewards accrue as new tokens. Expected Peg = 1 : 1'
	const valueAccruing = 'Value Accruing Token: Staking rewards are earned in form of an appreciating LSD value.'

	const ratesByName = new Map<string, ILsdRateApiItem>()
	for (const rate of ratesResult.data) {
		if (rate.name !== null) ratesByName.set(rate.name, rate)
	}

	// Prefer the pool for the exact LST instrument, then the largest eligible protocol pool.
	const apyByName = new Map<string, APYCandidate>()
	for (const pool of poolsResult.data) {
		const isCryptoCom = pool.project === 'crypto.com-staked-eth'
		const name = memberNameBySlug.get(pool.project)
		if (!name || (!isCryptoCom && (pool.chain !== 'Ethereum' || !pool.symbol.includes('ETH')))) continue
		const rateSymbol = ratesByName.get(name)?.symbol
		const candidate: APYCandidate = {
			apy: pool.apy,
			tvlUsd: pool.tvlUsd,
			exactSymbol: rateSymbol != null && pool.symbol === rateSymbol
		}
		const current = apyByName.get(name)
		if (
			!current ||
			(candidate.exactSymbol && !current.exactSymbol) ||
			(candidate.exactSymbol === current.exactSymbol &&
				candidate.tvlUsd != null &&
				(current.tvlUsd == null || candidate.tvlUsd > current.tvlUsd))
		) {
			apyByName.set(name, candidate)
		}
	}

	const tokensList: Array<ILSTTokenRow> = []
	const tokens: Array<string> = []
	for (const p of tokenTvls) {
		const lsd = ratesByName.get(p.name)
		const pegInfo = lsd?.type === 'rebase' ? rebase : lsd?.type === 'accruing' ? valueAccruing : null
		let ethPeg: ILSTPeg | null = null
		if (lsd && lsd.ethPeg !== null) {
			ethPeg = {
				deviation: lsd.ethPeg,
				marketRate: lsd.marketRate,
				expectedRate: lsd.expectedRate
			}
		}
		const mcap = p.mcap
		const mcaptvl = mcap != null && p.stakedEthInUsd != null && p.stakedEthInUsd !== 0 ? mcap / p.stakedEthInUsd : null

		const row = {
			...p,
			marketShare: (p.stakedEth / stakedEthSum) * 100,
			lsdSymbol: lsd?.symbol ?? null,
			ethPeg,
			pegInfo,
			mcapOverTvl: mcaptvl,
			apy: apyByName.get(p.name)?.apy ?? null,
			fee: lsd?.fee != null ? lsd.fee * 100 : null
		}
		tokens.push(row.name)
		tokensList.push(row)
	}

	// Colors go by staked ETH rank, the order every chart on the page ranks LSTs in.
	const lsdColors: Record<string, string> = { Others: OTHERS_COLOR }
	for (const [index, name] of tokens.entries()) lsdColors[name] = chartColor(index)

	const pieSeries = prepareRuntimePieChartData({
		data: tokenTvls,
		sliceIdentifier: 'name',
		sliceValue: 'stakedEth',
		limit: 10
	})

	// --- Inflows (daily deltas per protocol, using pre-grouped historicByName) ---
	const inflowsChartData: InflowsChartData = {}
	const barChartStacks: Record<string, string> = {}

	for (const protocol of tokens) {
		const series = historicByName.get(protocol)
		if (!series || series.length < 2) continue

		for (let i = 1; i < series.length; i++) {
			const curr = series[i]
			const previous = series[i - 1]
			if (!curr || !previous) continue
			const inflowsForDate = inflowsChartData[curr.date] ?? {}
			inflowsForDate[protocol] = curr.value - previous.value
			inflowsChartData[curr.date] = inflowsForDate
		}
		barChartStacks[protocol] = 'A'
	}

	return {
		areaChartData,
		pieSeries,
		tokensList,
		tokens,
		stakedEthSum,
		stakedEthInUsdSum,
		lsdColors,
		inflowsChartData,
		barChartStacks,
		ratesAvailable: ratesResult.available,
		apyAvailable: poolsResult.available
	}
}
