import type { DimensionDatasetProtocol } from '~/containers/AdapterMetrics/server/datasets'
import type {
	ChainMetricSnapshot,
	IFormattedProtocol,
	IParentProtocol
} from '~/containers/ProtocolLists/protocol-table.types'
import { removedCategoriesFromChainTvlSet } from '~/containers/ProtocolRankings/constants'
import { getMarketCapToAnnualizedMetricRatio, getPercentChange } from '~/utils'
import type { IProtocolRow, ProTableDimensionProtocol } from './proTable.types'

function addElement(
	key: string,
	curr: IFormattedProtocol,
	acc: Record<string, number | null | undefined>,
	hasAtleastOnceValue: Record<string, boolean>
) {
	const value = (curr as unknown as Record<string, unknown>)[key]
	if (typeof value === 'number') {
		hasAtleastOnceValue[key] = true
		acc[key] = (acc[key] ?? 0) + value
	} else {
		if (!hasAtleastOnceValue[key]) {
			acc[key] = undefined
		}
	}
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const hasAnyNumber = (protocol: IFormattedProtocol, keys: string[]): boolean => {
	const row = protocol as unknown as Record<string, unknown>
	return keys.some((key) => isFiniteNumber(row[key]))
}

const setOptionalProperty = <T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void => {
	if (value === undefined) delete target[key]
	else target[key] = value
}

const FEE_ANNUALIZED_CONTRIBUTOR_KEYS = ['fees_24h', 'fees_7d', 'fees_30d', 'fees_1y', 'cumulativeFees']
const REVENUE_ANNUALIZED_CONTRIBUTOR_KEYS = ['revenue_24h', 'revenue_7d', 'revenue_30d', 'revenue_1y']

interface GroupAccumulator {
	mcap: number
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
	[key: string]: number | null | undefined
}

// group protocols so we can show child protocols inside an accordion in a table
const groupData = (protocols: IFormattedProtocol[], parent: IParentProtocol, noSubrows?: boolean): IProtocolRow => {
	let strikeTvl = false
	let parentExcluded = false
	const categories = new Set<string | null>()

	const hasAtleastOnceValue: Record<string, boolean> = {}
	let weightedVolumeChange = 0
	let totalVolumeWeight = 0
	let weightedPerpsVolumeChange = 0
	let totalPerpsVolumeWeight = 0
	let hasFeesAnnualized1y = false
	let isFeesAnnualized1yIncomplete = false
	let hasRevenueAnnualized1y = false
	let isRevenueAnnualized1yIncomplete = false
	let hasTvlContributor = false

	const {
		mcap,
		tvl,
		tvlPrevDay,
		tvlPrevWeek,
		tvlPrevMonth,
		volume_24h,
		volume_7d,
		volume_30d,
		cumulativeVolume,
		perps_volume_24h,
		perps_volume_7d,
		perps_volume_30d,
		openInterest,
		fees_7d,
		fees_24h,
		fees_30d,
		fees_1y,
		feesAnnualized1y,
		revenue_24h,
		revenue_7d,
		revenue_30d,
		revenue_1y,
		revenueAnnualized1y,
		holderRevenue_24h,
		holdersRevenue30d,
		userFees_24h,
		cumulativeFees,
		treasuryRevenue_24h,
		supplySideRevenue_24h
	} = protocols.reduce<GroupAccumulator>(
		(acc, curr) => {
			if (curr.strikeTvl) {
				strikeTvl = true
			}
			if (curr.contributesTvl && curr.extraTvl?.excludeParent) {
				parentExcluded = true
			}

			if (curr.category) {
				categories.add(curr.category)
			}

			if (isFiniteNumber(curr.feesAnnualized1y)) {
				hasFeesAnnualized1y = true
			} else if (hasAnyNumber(curr, FEE_ANNUALIZED_CONTRIBUTOR_KEYS)) {
				isFeesAnnualized1yIncomplete = true
			}

			if (isFiniteNumber(curr.revenueAnnualized1y)) {
				hasRevenueAnnualized1y = true
			} else if (hasAnyNumber(curr, REVENUE_ANNUALIZED_CONTRIBUTOR_KEYS)) {
				isRevenueAnnualized1yIncomplete = true
			}

			if (curr.contributesTvl) {
				hasTvlContributor = true
				acc.tvl = acc.tvl === null || curr.tvl == null ? null : acc.tvl + curr.tvl

				if (curr.extraTvl?.excludeParent) {
					for (const key of ['tvl', 'tvlPrevDay', 'tvlPrevWeek', 'tvlPrevMonth'] as const) {
						const excludeVal = curr.extraTvl.excludeParent[key]
						if (acc[key] === null) continue
						acc[key] = excludeVal == null ? null : (acc[key] ?? 0) - excludeVal
					}
				}

				for (const key of ['tvlPrevDay', 'tvlPrevWeek', 'tvlPrevMonth'] as const) {
					if (acc[key] === null) continue
					const value = curr[key]
					acc[key] = value == null ? null : (acc[key] ?? 0) + value
				}
			}

			for (const key of [
				'volume_24h',
				'volume_7d',
				'volume_30d',
				'cumulativeVolume',
				'perps_volume_24h',
				'perps_volume_7d',
				'perps_volume_30d',
				'openInterest',
				'fees_7d',
				'fees_24h',
				'fees_30d',
				'fees_1y',
				'feesAnnualized1y',
				'revenue_24h',
				'revenue_7d',
				'revenue_30d',
				'revenue_1y',
				'revenueAnnualized1y',
				'holderRevenue_24h',
				'holdersRevenue30d',
				'userFees_24h',
				'cumulativeFees',
				'treasuryRevenue_24h',
				'supplySideRevenue_24h'
			]) {
				addElement(key, curr, acc, hasAtleastOnceValue)
			}

			if (curr.mcap) {
				acc.mcap = acc.mcap + curr.mcap
			}

			if (curr.volume_7d && curr.volumeChange_7d != null) {
				weightedVolumeChange += curr.volumeChange_7d * curr.volume_7d
				totalVolumeWeight += curr.volume_7d
			}

			if (curr.perps_volume_7d && curr.perps_volume_change_7d != null) {
				weightedPerpsVolumeChange += curr.perps_volume_change_7d * curr.perps_volume_7d
				totalPerpsVolumeWeight += curr.perps_volume_7d
			}

			return acc
		},
		{
			mcap: 0,
			tvl: 0,
			tvlPrevDay: 0,
			tvlPrevWeek: 0,
			tvlPrevMonth: 0,
			volume_24h: 0,
			volume_7d: 0,
			volume_30d: 0,
			cumulativeVolume: 0,
			perps_volume_24h: 0,
			perps_volume_7d: 0,
			perps_volume_30d: 0,
			openInterest: 0,
			fees_7d: 0,
			fees_24h: 0,
			fees_30d: 0,
			fees_1y: 0,
			feesAnnualized1y: 0,
			revenue_24h: 0,
			revenue_7d: 0,
			revenue_30d: 0,
			revenue_1y: 0,
			revenueAnnualized1y: 0,
			holderRevenue_24h: 0,
			holdersRevenue30d: 0,
			userFees_24h: 0,
			cumulativeFees: 0,
			treasuryRevenue_24h: 0,
			supplySideRevenue_24h: 0
		}
	)
	const parentTvl = hasTvlContributor ? tvl : null
	const parentTvlPrevDay = hasTvlContributor ? tvlPrevDay : null
	const parentTvlPrevWeek = hasTvlContributor ? tvlPrevWeek : null
	const parentTvlPrevMonth = hasTvlContributor ? tvlPrevMonth : null

	const change1d: number | null = getPercentChange(parentTvl, parentTvlPrevDay)
	const change7d: number | null = getPercentChange(parentTvl, parentTvlPrevWeek)
	const change1m: number | null = getPercentChange(parentTvl, parentTvlPrevMonth)

	let volumeChange_7d = null
	if (totalVolumeWeight > 0) {
		volumeChange_7d = weightedVolumeChange / totalVolumeWeight
	}

	let perps_volume_change_7d = null
	if (totalPerpsVolumeWeight > 0) {
		perps_volume_change_7d = weightedPerpsVolumeChange / totalPerpsVolumeWeight
	}

	const finalMcap = mcap > 0 ? mcap : (parent?.mcap ?? 0)
	const finalFeesAnnualized1y = hasFeesAnnualized1y && !isFeesAnnualized1yIncomplete ? (feesAnnualized1y ?? null) : null
	const finalRevenueAnnualized1y =
		hasRevenueAnnualized1y && !isRevenueAnnualized1yIncomplete ? (revenueAnnualized1y ?? null) : null
	const pf = getMarketCapToAnnualizedMetricRatio(finalMcap, finalFeesAnnualized1y)
	const ps = getMarketCapToAnnualizedMetricRatio(finalMcap, finalRevenueAnnualized1y)

	const parentMcapTvl = parentTvl != null && parentTvl > 0 ? finalMcap / parentTvl : null
	const mcaptvl = parentMcapTvl !== null && Number.isFinite(parentMcapTvl) ? parentMcapTvl : null

	const oracleSet = new Set<string>()
	const oraclesByChainAgg: Record<string, Set<string>> = {}
	const addOracles = (obj: { oracles?: string[]; oraclesByChain?: Record<string, string[]> }) => {
		if (Array.isArray(obj.oracles)) {
			for (const o of obj.oracles) {
				oracleSet.add(o)
			}
		}
		if (obj.oraclesByChain) {
			for (const k in obj.oraclesByChain) {
				const set = (oraclesByChainAgg[k] = oraclesByChainAgg[k] || new Set<string>())
				for (const o of obj.oraclesByChain[k] || []) {
					set.add(o)
				}
			}
		}
	}
	addOracles(parent)
	for (const protocol of protocols) {
		addOracles(protocol)
	}
	const aggregatedOraclesByChain: Record<string, string[]> = {}
	for (const k in oraclesByChainAgg) {
		const v = oraclesByChainAgg[k]
		if (!v) continue
		aggregatedOraclesByChain[k] = Array.from(v).sort((a, b) => a.localeCompare(b))
	}

	const groupedProtocol: IProtocolRow = {
		name: parent.name,
		logo: parent.logo,
		url: parent.url,
		chains: parent.chains,
		contributesTvl: hasTvlContributor,
		defillamaId: parent.id,
		tvl: parentTvl,
		tvlPrevDay: parentTvlPrevDay,
		tvlPrevWeek: parentTvlPrevWeek,
		tvlPrevMonth: parentTvlPrevMonth,
		change_1d: change1d,
		change_7d: change7d,
		change_1m: change1m,
		feesAnnualized1y: finalFeesAnnualized1y,
		revenueAnnualized1y: finalRevenueAnnualized1y,
		volumeChange_7d,
		perps_volume_change_7d,
		pf,
		ps,
		mcap: finalMcap,
		mcaptvl,
		extraTvl: {},
		symbol: null,
		category: categories.size > 1 ? null : Array.from(categories).join(', '),
		...(noSubrows ? {} : { subRows: [...protocols] }),
		chainTvls: {},
		strikeTvl,
		parentExcluded,
		isParentProtocol: true,
		oracles: Array.from(oracleSet).sort((a, b) => a.localeCompare(b)),
		oraclesByChain: aggregatedOraclesByChain
	}
	setOptionalProperty(groupedProtocol, 'fees_24h', fees_24h)
	setOptionalProperty(groupedProtocol, 'fees_7d', fees_7d)
	setOptionalProperty(groupedProtocol, 'fees_30d', fees_30d)
	setOptionalProperty(groupedProtocol, 'fees_1y', fees_1y)
	setOptionalProperty(groupedProtocol, 'revenue_24h', revenue_24h)
	setOptionalProperty(groupedProtocol, 'revenue_7d', revenue_7d)
	setOptionalProperty(groupedProtocol, 'revenue_30d', revenue_30d)
	setOptionalProperty(groupedProtocol, 'revenue_1y', revenue_1y)
	setOptionalProperty(groupedProtocol, 'holderRevenue_24h', holderRevenue_24h)
	setOptionalProperty(groupedProtocol, 'holdersRevenue30d', holdersRevenue30d)
	setOptionalProperty(groupedProtocol, 'userFees_24h', userFees_24h)
	setOptionalProperty(groupedProtocol, 'cumulativeFees', cumulativeFees)
	setOptionalProperty(groupedProtocol, 'treasuryRevenue_24h', treasuryRevenue_24h)
	setOptionalProperty(groupedProtocol, 'supplySideRevenue_24h', supplySideRevenue_24h)
	setOptionalProperty(groupedProtocol, 'volume_24h', volume_24h)
	setOptionalProperty(groupedProtocol, 'volume_7d', volume_7d)
	setOptionalProperty(groupedProtocol, 'volume_30d', volume_30d)
	setOptionalProperty(groupedProtocol, 'cumulativeVolume', cumulativeVolume)
	setOptionalProperty(groupedProtocol, 'perps_volume_24h', perps_volume_24h)
	setOptionalProperty(groupedProtocol, 'perps_volume_7d', perps_volume_7d)
	setOptionalProperty(groupedProtocol, 'perps_volume_30d', perps_volume_30d)
	setOptionalProperty(groupedProtocol, 'openInterest', openInterest)
	return groupedProtocol
}

const groupProtocols = (
	protocols: Readonly<IFormattedProtocol[]>,
	parentProtocols: Readonly<IParentProtocol[]>,
	noSubrows?: boolean
) => {
	const childrenByParent = new Map<string, IFormattedProtocol[]>()
	for (const protocol of protocols) {
		if (!protocol.parentProtocol) continue
		const siblings = childrenByParent.get(protocol.parentProtocol)
		if (siblings) siblings.push(protocol)
		else childrenByParent.set(protocol.parentProtocol, [protocol])
	}

	const groupedParentIds = new Set<string>()
	const groupedParents: IProtocolRow[] = []
	for (const parent of parentProtocols) {
		const children = childrenByParent.get(parent.id)
		if (!children || children.length < 2) continue
		groupedParentIds.add(parent.id)
		groupedParents.push(groupData(children, parent, noSubrows))
	}

	const data: IProtocolRow[] = protocols.filter(
		(protocol) => !protocol.parentProtocol || !groupedParentIds.has(protocol.parentProtocol)
	)
	data.push(...groupedParents)

	return data.sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
}

type DimensionDatasetItem = DimensionDatasetProtocol

export const formatProtocolsList = ({
	protocols,
	parentProtocols,
	extraTvlsEnabled,
	volumeData,
	feesData,
	perpsData,
	openInterestData,
	earningsData,
	aggregatorsData,
	bridgeAggregatorsData,
	optionsData,
	noSubrows
}: {
	protocols: IFormattedProtocol[]
	parentProtocols: IParentProtocol[]
	extraTvlsEnabled: Record<string, boolean>
	volumeData?: ProTableDimensionProtocol[]
	feesData?: ProTableDimensionProtocol[]
	perpsData?: ProTableDimensionProtocol[]
	openInterestData?: ProTableDimensionProtocol[]
	earningsData?: DimensionDatasetItem[]
	aggregatorsData?: DimensionDatasetItem[]
	bridgeAggregatorsData?: DimensionDatasetItem[]
	optionsData?: DimensionDatasetItem[]
	noSubrows?: boolean
}): IProtocolRow[] => {
	const checkExtras: Record<string, boolean> = {
		...extraTvlsEnabled,
		doublecounted: !extraTvlsEnabled.doublecounted
	}

	const mergeChainBreakdown = (
		existing: Record<string, ChainMetricSnapshot> | undefined,
		incoming?: Record<string, unknown>
	): Record<string, ChainMetricSnapshot> | undefined => {
		if (!incoming) return existing
		const next: Record<string, ChainMetricSnapshot> = { ...(existing ?? {}) }
		for (const key in incoming) {
			const rawValue = incoming[key]
			if (!rawValue || typeof rawValue !== 'object') continue
			const value = rawValue as Record<string, unknown>
			const chainLabel = typeof value.chain === 'string' && value.chain.trim().length ? value.chain : key
			const normalizedKey =
				typeof chainLabel === 'string' && chainLabel.trim().length
					? chainLabel.trim().toLowerCase()
					: key.trim().toLowerCase()
			next[normalizedKey] = {
				...(value as ChainMetricSnapshot),
				chain: chainLabel
			}
		}
		return next
	}

	const getChainBreakdown = (item: object): Record<string, unknown> | undefined => {
		const rec = item as Record<string, unknown>
		return typeof rec.chainBreakdown === 'object' && rec.chainBreakdown != null
			? (rec.chainBreakdown as Record<string, unknown>)
			: undefined
	}

	const allProtocols: Record<string, IFormattedProtocol> = {}

	// Use for..in loop instead of Object.values() for better performance
	let shouldModifyTvl = false
	for (const key in checkExtras) {
		if (checkExtras[key]) {
			shouldModifyTvl = true
			break
		}
	}

	for (const protocol of protocols) {
		const { tvl, tvlPrevDay, tvlPrevWeek, tvlPrevMonth, extraTvl, mcap, name, ...props } = protocol
		const protocolName = name?.toLowerCase()
		if (!protocolName) continue
		let finalTvl: number | null = tvl
		let finalTvlPrevDay: number | null = tvlPrevDay
		let finalTvlPrevWeek: number | null = tvlPrevWeek
		let finalTvlPrevMonth: number | null = tvlPrevMonth
		let strikeTvl = false

		if (shouldModifyTvl) {
			// keep liquid staking in same position in table but strike its tvl
			if (props.category === 'Liquid Staking' && !extraTvlsEnabled['liquidstaking']) {
				strikeTvl = true
			}

			if (props.category != null && removedCategoriesFromChainTvlSet.has(props.category)) {
				strikeTvl = true
			}

			for (const prop in extraTvl ?? {}) {
				const {
					tvl: extraTvlValue,
					tvlPrevDay: extraTvlPrevDay,
					tvlPrevWeek: extraTvlPrevWeek,
					tvlPrevMonth: extraTvlPrevMonth
				} = extraTvl?.[prop] ?? {}
				if (
					prop === 'doublecounted' &&
					!extraTvlsEnabled['doublecounted'] &&
					(props.category === 'Liquid Staking' ? !extraTvlsEnabled['liquidstaking'] : true)
				) {
					strikeTvl = true
				} else {
					// convert to lowercase as server response is not consistent in extra-tvl names
					if (
						extraTvlsEnabled[prop.toLowerCase()] &&
						prop.toLowerCase() !== 'doublecounted' &&
						prop.toLowerCase() !== 'liquidstaking'
					) {
						// check if final tvls are null, if they are null and tvl exist on selected option, convert to 0 and add them
						finalTvl = finalTvl === null || extraTvlValue == null ? null : finalTvl + extraTvlValue
						finalTvlPrevDay =
							finalTvlPrevDay === null || extraTvlPrevDay == null ? null : finalTvlPrevDay + extraTvlPrevDay
						finalTvlPrevWeek =
							finalTvlPrevWeek === null || extraTvlPrevWeek == null ? null : finalTvlPrevWeek + extraTvlPrevWeek
						finalTvlPrevMonth =
							finalTvlPrevMonth === null || extraTvlPrevMonth == null ? null : finalTvlPrevMonth + extraTvlPrevMonth
					}
				}
			}
		}

		let change1d: number | null = getPercentChange(finalTvl, finalTvlPrevDay)
		let change7d: number | null = getPercentChange(finalTvl, finalTvlPrevWeek)
		let change1m: number | null = getPercentChange(finalTvl, finalTvlPrevMonth)

		let mcaptvl: number | null = null
		{
			const t = finalTvl
			if (mcap != null && t != null && t > 0) {
				const ratio = mcap / t
				mcaptvl = Number.isFinite(ratio) ? ratio : null
			}
		}

		const next: IFormattedProtocol = {
			...props,
			name,
			tvl: finalTvl,
			tvlPrevDay: finalTvlPrevDay,
			tvlPrevWeek: finalTvlPrevWeek,
			tvlPrevMonth: finalTvlPrevMonth,
			change_1d: change1d,
			change_7d: change7d,
			change_1m: change1m,
			mcaptvl,
			strikeTvl
		}
		setOptionalProperty(next, 'extraTvl', extraTvl)
		setOptionalProperty(next, 'mcap', mcap)
		allProtocols[protocolName] = next
	}

	for (const protocol of feesData ?? []) {
		const protocolName = protocol.name?.toLowerCase()
		if (!protocolName) continue
		if (!allProtocols[protocolName]) {
			allProtocols[protocolName] = { name: protocol.displayName ?? protocol.name } as IFormattedProtocol
		}

		const previous = allProtocols[protocolName]
		const mergedChains = Array.from(new Set([...(previous.chains ?? []), ...(protocol.chains ?? [])]))
		const next: IFormattedProtocol = {
			...previous,
			chains: mergedChains,
			pf: getMarketCapToAnnualizedMetricRatio(previous.mcap, protocol.annualized1y),
			ps: getMarketCapToAnnualizedMetricRatio(previous.mcap, protocol.revenueAnnualized1y)
		}
		setOptionalProperty(next, 'fees_24h', protocol.total24h ?? undefined)
		setOptionalProperty(next, 'revenue_24h', protocol.revenue24h ?? undefined)
		setOptionalProperty(next, 'fees_7d', protocol.total7d ?? undefined)
		setOptionalProperty(next, 'revenue_7d', protocol.revenue7d ?? undefined)
		setOptionalProperty(next, 'fees_30d', protocol.total30d ?? undefined)
		setOptionalProperty(next, 'fees_1y', protocol.total1y ?? undefined)
		setOptionalProperty(next, 'feesAnnualized1y', protocol.annualized1y ?? undefined)
		setOptionalProperty(next, 'revenue_30d', protocol.revenue30d ?? undefined)
		setOptionalProperty(next, 'revenue_1y', protocol.revenue1y ?? undefined)
		setOptionalProperty(next, 'revenueAnnualized1y', protocol.revenueAnnualized1y ?? undefined)
		setOptionalProperty(next, 'feesChange_1d', protocol.feesChange_1d ?? previous.feesChange_1d ?? undefined)
		setOptionalProperty(next, 'feesChange_7d', protocol.feesChange_7d ?? previous.feesChange_7d ?? undefined)
		setOptionalProperty(next, 'feesChange_1m', protocol.feesChange_1m ?? previous.feesChange_1m ?? undefined)
		setOptionalProperty(next, 'feesChange_7dover7d', protocol.feesChange_7dover7d ?? undefined)
		setOptionalProperty(next, 'feesChange_30dover30d', protocol.feesChange_30dover30d ?? undefined)
		setOptionalProperty(next, 'revenueChange_1d', protocol.revenueChange_1d ?? previous.revenueChange_1d ?? undefined)
		setOptionalProperty(next, 'revenueChange_7d', protocol.revenueChange_7d ?? previous.revenueChange_7d ?? undefined)
		setOptionalProperty(next, 'revenueChange_1m', protocol.revenueChange_1m ?? previous.revenueChange_1m ?? undefined)
		setOptionalProperty(next, 'revenueChange_7dover7d', protocol.revenueChange_7dover7d ?? undefined)
		setOptionalProperty(next, 'revenueChange_30dover30d', protocol.revenueChange_30dover30d ?? undefined)
		setOptionalProperty(next, 'average_1y', protocol.monthlyAverage1y ?? undefined)
		setOptionalProperty(next, 'average_revenue_1y', protocol.averageRevenue1y ?? undefined)
		setOptionalProperty(next, 'holdersRevenue30d', protocol.holdersRevenue30d ?? undefined)
		setOptionalProperty(next, 'holderRevenue_24h', protocol.holdersRevenue24h ?? undefined)
		setOptionalProperty(next, 'holdersRevenueChange_30dover30d', protocol.holdersRevenueChange_30dover30d ?? undefined)
		setOptionalProperty(next, 'treasuryRevenue_24h', protocol.dailyProtocolRevenue ?? undefined)
		setOptionalProperty(next, 'supplySideRevenue_24h', protocol.dailySupplySideRevenue ?? undefined)
		setOptionalProperty(next, 'userFees_24h', protocol.dailyUserFees ?? undefined)
		setOptionalProperty(next, 'cumulativeFees', protocol.totalAllTime ?? undefined)
		setOptionalProperty(next, 'feesByChain', mergeChainBreakdown(previous.feesByChain, getChainBreakdown(protocol)))
		setOptionalProperty(
			next,
			'revenueByChain',
			mergeChainBreakdown(previous.revenueByChain, getChainBreakdown(protocol))
		)

		allProtocols[protocolName] = next
	}

	for (const protocol of volumeData ?? []) {
		const protocolName = protocol.name?.toLowerCase()
		if (!protocolName) continue
		if (!allProtocols[protocolName]) {
			allProtocols[protocolName] = { name: protocol.displayName ?? protocol.name } as IFormattedProtocol
		}
		const previous = allProtocols[protocolName]
		const mergedChains = Array.from(new Set([...(previous.chains ?? []), ...(protocol.chains ?? [])]))
		const next: IFormattedProtocol = {
			...previous,
			chains: mergedChains
		}
		setOptionalProperty(next, 'volume_24h', protocol.total24h ?? undefined)
		setOptionalProperty(next, 'volume_7d', protocol.total7d ?? undefined)
		setOptionalProperty(next, 'volume_30d', protocol.total30d ?? undefined)
		setOptionalProperty(next, 'volumeChange_1d', protocol.change_1d ?? previous.volumeChange_1d)
		setOptionalProperty(next, 'volumeChange_7d', protocol.change_7d ?? previous.volumeChange_7d)
		setOptionalProperty(next, 'volumeChange_1m', protocol.change_1m ?? previous.volumeChange_1m)
		setOptionalProperty(next, 'cumulativeVolume', protocol.totalAllTime ?? previous.cumulativeVolume)
		setOptionalProperty(next, 'volumeByChain', mergeChainBreakdown(previous.volumeByChain, getChainBreakdown(protocol)))
		allProtocols[protocolName] = next
	}

	for (const protocol of perpsData ?? []) {
		const protocolName = protocol.name?.toLowerCase()
		if (!protocolName) continue
		if (!allProtocols[protocolName]) {
			allProtocols[protocolName] = { name: protocol.displayName ?? protocol.name } as IFormattedProtocol
		}
		const previous = allProtocols[protocolName]
		const mergedChains = Array.from(new Set([...(previous.chains ?? []), ...(protocol.chains ?? [])]))
		const next: IFormattedProtocol = {
			...previous,
			chains: mergedChains
		}
		setOptionalProperty(next, 'perps_volume_24h', protocol.total24h ?? undefined)
		setOptionalProperty(next, 'perps_volume_7d', protocol.total7d ?? undefined)
		setOptionalProperty(next, 'perps_volume_30d', protocol.total30d ?? undefined)
		setOptionalProperty(next, 'perps_volume_change_1d', protocol.change_1d ?? previous.perps_volume_change_1d)
		setOptionalProperty(next, 'perps_volume_change_7d', protocol.change_7d ?? previous.perps_volume_change_7d)
		setOptionalProperty(next, 'perps_volume_change_1m', protocol.change_1m ?? previous.perps_volume_change_1m)
		setOptionalProperty(
			next,
			'perpsVolumeByChain',
			mergeChainBreakdown(previous.perpsVolumeByChain, getChainBreakdown(protocol))
		)
		allProtocols[protocolName] = next
	}

	for (const protocol of openInterestData ?? []) {
		const protocolName = protocol.name?.toLowerCase()
		if (!protocolName) continue
		if (!allProtocols[protocolName]) {
			allProtocols[protocolName] = { name: protocol.displayName ?? protocol.name } as IFormattedProtocol
		}
		const previous = allProtocols[protocolName]
		const mergedChains = Array.from(new Set([...(previous.chains ?? []), ...(protocol.chains ?? [])]))
		const next: IFormattedProtocol = {
			...previous,
			chains: mergedChains
		}
		setOptionalProperty(next, 'openInterest', protocol.total24h)
		setOptionalProperty(
			next,
			'openInterestByChain',
			mergeChainBreakdown(previous.openInterestByChain, getChainBreakdown(protocol))
		)
		allProtocols[protocolName] = next
	}

	for (const protocol of earningsData ?? []) {
		const protocolName = protocol.name?.toLowerCase()
		if (!protocolName) continue
		if (!allProtocols[protocolName]) {
			allProtocols[protocolName] = { name: protocol.displayName ?? protocol.name } as IFormattedProtocol
		}
		const previous = allProtocols[protocolName]
		const mergedChains = Array.from(new Set([...(previous.chains ?? []), ...(protocol.chains ?? [])]))
		const next: IFormattedProtocol = {
			...previous,
			chains: mergedChains
		}
		setOptionalProperty(next, 'earnings_24h', protocol.total24h ?? previous.earnings_24h)
		setOptionalProperty(next, 'earnings_7d', protocol.total7d ?? previous.earnings_7d)
		setOptionalProperty(next, 'earnings_30d', protocol.total30d ?? previous.earnings_30d)
		setOptionalProperty(next, 'earnings_1y', protocol.total1y ?? previous.earnings_1y)
		setOptionalProperty(next, 'earningsChange_1d', protocol.change_1d ?? previous.earningsChange_1d)
		setOptionalProperty(next, 'earningsChange_7d', protocol.change_7d ?? previous.earningsChange_7d)
		setOptionalProperty(next, 'earningsChange_1m', protocol.change_1m ?? previous.earningsChange_1m)
		setOptionalProperty(
			next,
			'earningsByChain',
			mergeChainBreakdown(previous.earningsByChain, getChainBreakdown(protocol))
		)
		allProtocols[protocolName] = next
	}

	const mergeVolumeDataset = (
		dataset: DimensionDatasetItem[] | undefined,
		assign: (protocol: IFormattedProtocol, item: DimensionDatasetItem) => void
	) => {
		for (const item of dataset ?? []) {
			const protocolName = item.name?.toLowerCase()
			if (!protocolName) continue
			if (!allProtocols[protocolName]) {
				allProtocols[protocolName] = { name: item.displayName ?? item.name } as IFormattedProtocol
			}
			const previous = allProtocols[protocolName]
			const next: IFormattedProtocol = {
				...previous,
				chains: Array.from(new Set([...(previous.chains ?? []), ...(item.chains ?? [])]))
			}
			assign(next, item)
			allProtocols[protocolName] = next
		}
	}

	mergeVolumeDataset(aggregatorsData, (protocol, item) => {
		setOptionalProperty(protocol, 'aggregators_volume_24h', item.total24h ?? protocol.aggregators_volume_24h)
		setOptionalProperty(protocol, 'aggregators_volume_7d', item.total7d ?? protocol.aggregators_volume_7d)
		setOptionalProperty(protocol, 'aggregators_volume_30d', item.total30d ?? protocol.aggregators_volume_30d)
		setOptionalProperty(
			protocol,
			'aggregators_volume_change_1d',
			item.change_1d ?? protocol.aggregators_volume_change_1d
		)
		setOptionalProperty(
			protocol,
			'aggregators_volume_change_7d',
			item.change_7d ?? protocol.aggregators_volume_change_7d
		)
		setOptionalProperty(
			protocol,
			'aggregatorsVolumeByChain',
			mergeChainBreakdown(protocol.aggregatorsVolumeByChain, item.chainBreakdown)
		)
	})

	mergeVolumeDataset(bridgeAggregatorsData, (protocol, item) => {
		setOptionalProperty(
			protocol,
			'bridge_aggregators_volume_24h',
			item.total24h ?? protocol.bridge_aggregators_volume_24h
		)
		setOptionalProperty(protocol, 'bridge_aggregators_volume_7d', item.total7d ?? protocol.bridge_aggregators_volume_7d)
		setOptionalProperty(
			protocol,
			'bridge_aggregators_volume_30d',
			item.total30d ?? protocol.bridge_aggregators_volume_30d
		)
		setOptionalProperty(
			protocol,
			'bridge_aggregators_volume_change_1d',
			item.change_1d ?? protocol.bridge_aggregators_volume_change_1d
		)
		setOptionalProperty(
			protocol,
			'bridge_aggregators_volume_change_7d',
			item.change_7d ?? protocol.bridge_aggregators_volume_change_7d
		)
		setOptionalProperty(
			protocol,
			'bridgeAggregatorsVolumeByChain',
			mergeChainBreakdown(protocol.bridgeAggregatorsVolumeByChain, item.chainBreakdown)
		)
	})

	mergeVolumeDataset(optionsData, (protocol, item) => {
		setOptionalProperty(protocol, 'options_volume_24h', item.total24h ?? protocol.options_volume_24h)
		setOptionalProperty(protocol, 'options_volume_7d', item.total7d ?? protocol.options_volume_7d)
		setOptionalProperty(protocol, 'options_volume_30d', item.total30d ?? protocol.options_volume_30d)
		setOptionalProperty(protocol, 'options_volume_change_1d', item.change_1d ?? protocol.options_volume_change_1d)
		setOptionalProperty(protocol, 'options_volume_change_7d', item.change_7d ?? protocol.options_volume_change_7d)
		setOptionalProperty(
			protocol,
			'optionsVolumeByChain',
			mergeChainBreakdown(protocol.optionsVolumeByChain, item.chainBreakdown)
		)
	})

	// Use for..in loop instead of Object.values() to avoid intermediate array
	const finalProtocols: IFormattedProtocol[] = []
	for (const key in allProtocols) {
		const protocol = allProtocols[key]
		if (protocol) finalProtocols.push(protocol)
	}

	let totalSpot24h = 0
	let totalSpot7d = 0
	let totalPerps24h = 0
	let totalAggregators24h = 0
	let totalAggregators7d = 0
	let totalBridgeAggregators24h = 0
	let totalOptions24h = 0
	for (const protocol of finalProtocols) {
		totalSpot24h += protocol.volume_24h ?? 0
		totalSpot7d += protocol.volume_7d ?? 0
		totalPerps24h += protocol.perps_volume_24h ?? 0
		totalAggregators24h += protocol.aggregators_volume_24h ?? 0
		totalAggregators7d += protocol.aggregators_volume_7d ?? 0
		totalBridgeAggregators24h += protocol.bridge_aggregators_volume_24h ?? 0
		totalOptions24h += protocol.options_volume_24h ?? 0
	}

	const protocolsWithShares: IFormattedProtocol[] = finalProtocols.map((protocol) => {
		const next: IFormattedProtocol = { ...protocol }
		if (totalSpot24h > 0 && protocol.volume_24h) {
			next.volumeDominance_24h = (protocol.volume_24h / totalSpot24h) * 100
		}
		if (totalSpot7d > 0 && protocol.volume_7d) {
			next.volumeMarketShare7d = (protocol.volume_7d / totalSpot7d) * 100
		}
		if (totalPerps24h > 0 && protocol.perps_volume_24h) {
			next.perps_volume_dominance_24h = (protocol.perps_volume_24h / totalPerps24h) * 100
		}
		if (totalAggregators24h > 0 && protocol.aggregators_volume_24h) {
			next.aggregators_volume_dominance_24h = (protocol.aggregators_volume_24h / totalAggregators24h) * 100
		}
		if (totalAggregators7d > 0 && protocol.aggregators_volume_7d) {
			next.aggregators_volume_marketShare7d = (protocol.aggregators_volume_7d / totalAggregators7d) * 100
		}
		if (totalBridgeAggregators24h > 0 && protocol.bridge_aggregators_volume_24h) {
			next.bridge_aggregators_volume_dominance_24h =
				(protocol.bridge_aggregators_volume_24h / totalBridgeAggregators24h) * 100
		}
		if (totalOptions24h > 0 && protocol.options_volume_24h) {
			next.options_volume_dominance_24h = (protocol.options_volume_24h / totalOptions24h) * 100
		}
		return next
	})

	return parentProtocols ? groupProtocols(protocolsWithShares, parentProtocols, noSubrows) : protocolsWithShares
}
