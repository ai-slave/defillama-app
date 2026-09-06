import { useMemo } from 'react'
import { isChainsCategoryGroupKey, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { capitalizeFirstLetter, getPercentChange } from '~/utils'
import type { StablecoinBridges } from './types'

type StablecoinCirculatingInput = {
	name: string
	circulating?: number | null
	unreleased?: number | null
	pegType?: string | null
	pegDeviation?: number | null
	mcap?: number | null
	delisted?: boolean
}

type StablecoinCirculatingOutput<T extends StablecoinCirculatingInput> = T & {
	circulating: number | null
	unreleased: number | null
	pegType: string
	pegDeviation: number | null
	depeggedTwoPercent: boolean
	floatingPeg: boolean
}

type StablecoinBridgeInfo = {
	name: string
	link?: string
}

/** Minimal shape required by `useGroupBridgeData` for each chain entry. */
type GroupBridgeDataInput = {
	name: string
	symbol: string
	circulating: number | null
	unreleased: number | null
	bridgedAmount: number | null
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	bridges: StablecoinBridges
	circulatingPrevDay: number | null
	circulatingPrevWeek: number | null
	circulatingPrevMonth: number | null
}

type StablecoinUsageByChainRow = GroupBridgeDataInput & {
	bridgedPercent: number | null
	bridgeInfo: StablecoinBridgeInfo
	subRows?: Array<StablecoinUsageByChainRow>
}

type BridgeInfo = {
	[bridgeID: string]: StablecoinBridgeInfo
}

type DataValue = number | null

interface IGroupData {
	[key: string]: Record<string, Array<string>>
}

export const calcCirculating = <T extends StablecoinCirculatingInput>(
	filteredPeggedAssets: Array<T>,
	includeUnreleased?: boolean
): Array<StablecoinCirculatingOutput<T>> => {
	const shouldIncludeUnreleased = Boolean(includeUnreleased)
	const updatedPeggedAssets: Array<StablecoinCirculatingOutput<T>> = []
	for (const asset of filteredPeggedAssets) {
		const unreleased = asset.unreleased ?? null
		const pegType = asset.pegType ?? ''
		const pegDeviation = asset.pegDeviation ?? null

		let circulating = asset.circulating ?? null
		if (circulating != null && shouldIncludeUnreleased) {
			circulating = unreleased == null ? null : circulating + unreleased
		}

		const updatedAsset: StablecoinCirculatingOutput<T> = {
			...asset,
			circulating,
			unreleased,
			pegType,
			pegDeviation,
			depeggedTwoPercent: pegDeviation != null && 2 < Math.abs(pegDeviation),
			floatingPeg: pegType === 'peggedVAR'
		}
		updatedPeggedAssets.push(updatedAsset)
	}

	return updatedPeggedAssets.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))
}

export const useCalcCirculating = <T extends StablecoinCirculatingInput>(
	filteredPeggedAssets: Array<T>,
	includeUnreleased?: boolean
): Array<StablecoinCirculatingOutput<T>> => {
	return useMemo(
		() => calcCirculating(filteredPeggedAssets, includeUnreleased),
		[filteredPeggedAssets, includeUnreleased]
	)
}
interface StablecoinsChainsRow {
	name: string
	mcap: number | null
	mcapPrevDay: number | null
	mcapPrevWeek: number | null
	mcapPrevMonth: number | null
	unreleased: number | null
	bridgedTo: number | null
	minted: number | null
	dominance?: { name: string; value: number | string | null } | null
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	subRows?: Array<StablecoinsChainsRow>
}

const addAvailableValue = (total: DataValue, value: DataValue): DataValue =>
	value == null ? total : (total ?? 0) + value

export const groupChainsPegged = (
	chains: Array<StablecoinsChainsRow>,
	groupData: IGroupData,
	groupsEnabled: Readonly<Record<string, boolean | undefined>>
): Array<StablecoinsChainsRow> => {
	// Build lookup map for O(1) access by name
	const chainsByName = new Map<string, StablecoinsChainsRow>()
	for (const item of chains) {
		chainsByName.set(item.name, item)
	}

	const finalData: Record<string, StablecoinsChainsRow> = {}
	const addedChains = new Set<string>()
	for (const parentName in groupData) {
		const parentGroup = groupData[parentName]
		if (!parentGroup) continue
		let mcap: DataValue = null
		let unreleased: DataValue = null
		let bridgedTo: DataValue = null
		let minted: DataValue = null
		let dominance: { name: string; value: number | string | null } | null = null
		let mcapPrevDay = 0
		let mcapPrevWeek = 0
		let mcapPrevMonth = 0
		let hasCompletePrevDay = true
		let hasCompletePrevWeek = true
		let hasCompletePrevMonth = true
		const addMcapSnapshots = (row: StablecoinsChainsRow) => {
			if (row.mcap == null) return
			mcap = (mcap ?? 0) + row.mcap
			if (row.mcapPrevDay == null) hasCompletePrevDay = false
			else mcapPrevDay += row.mcapPrevDay
			if (row.mcapPrevWeek == null) hasCompletePrevWeek = false
			else mcapPrevWeek += row.mcapPrevWeek
			if (row.mcapPrevMonth == null) hasCompletePrevMonth = false
			else mcapPrevMonth += row.mcapPrevMonth
		}
		const parentData = chainsByName.get(parentName)
		if (parentData) {
			addMcapSnapshots(parentData)
			unreleased = parentData.unreleased
			bridgedTo = parentData.bridgedTo
			minted = parentData.minted
			finalData[parentName] = {
				...parentData,
				subRows: [parentData]
			}

			addedChains.add(parentName)
		}

		let addedChildren = false
		// O(1) Set lookup for already added children (built once per parent)
		const alreadyAddedNames = new Set<string>()
		for (const row of finalData[parentName]?.subRows ?? []) {
			alreadyAddedNames.add(row.name)
		}

		for (const type in parentGroup) {
			if (!isChainsCategoryGroupKey(type) || groupsEnabled[type] !== true) {
				continue
			}
			const children = parentGroup[type]
			if (!children) continue

			for (const child of children) {
				const childData = chainsByName.get(child)

				// O(1) Set lookup instead of O(n) .find()
				const alreadyAdded = alreadyAddedNames.has(child)

				if (childData && !alreadyAdded) {
					addMcapSnapshots(childData)
					unreleased = addAvailableValue(unreleased, childData.unreleased)
					bridgedTo = addAvailableValue(bridgedTo, childData.bridgedTo)
					minted = addAvailableValue(minted, childData.minted)
					dominance = null
					const subChains = finalData[parentName]?.subRows || []

					const groupedPrevDay = mcap != null && hasCompletePrevDay ? mcapPrevDay : null
					const groupedPrevWeek = mcap != null && hasCompletePrevWeek ? mcapPrevWeek : null
					const groupedPrevMonth = mcap != null && hasCompletePrevMonth ? mcapPrevMonth : null
					finalData[parentName] = {
						...finalData[parentName],
						mcap,
						mcapPrevDay: groupedPrevDay,
						mcapPrevWeek: groupedPrevWeek,
						mcapPrevMonth: groupedPrevMonth,
						change_1d: getPercentChange(mcap, groupedPrevDay),
						change_7d: getPercentChange(mcap, groupedPrevWeek),
						change_1m: getPercentChange(mcap, groupedPrevMonth),
						unreleased,
						bridgedTo,
						minted,
						dominance,
						name: parentName,
						subRows: [...subChains, childData]
					}
					addedChains.add(child)
					alreadyAddedNames.add(child)
					addedChildren = true
				}
			}
		}
		if (!addedChildren) {
			if (finalData[parentName]?.mcap === undefined) {
				delete finalData[parentName]
			} else if (parentData) {
				finalData[parentName] = parentData
			}
		}
	}

	for (const item of chains) {
		if (!addedChains.has(item.name)) {
			finalData[item.name] = item
		}
	}
	const result: Array<StablecoinsChainsRow> = []
	for (const name in finalData) result.push(finalData[name]!)
	return result.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))
}

export const useGroupChainsPegged = (
	chains: Array<StablecoinsChainsRow>,
	groupData: IGroupData
): Array<StablecoinsChainsRow> => {
	const [groupsEnabled] = useLocalStorageSettingsManager('tvl_chains')
	return useMemo(() => groupChainsPegged(chains, groupData, groupsEnabled), [chains, groupData, groupsEnabled])
}

export const groupBridgeData = (
	chains: Array<GroupBridgeDataInput>,
	bridgeInfoObject: BridgeInfo
): Array<StablecoinUsageByChainRow> => {
	const finalData: Record<string, StablecoinUsageByChainRow> = {}
	for (const parent of chains) {
		const parentBridges = parent.bridges
		const percentBridged =
			parent.circulating != null && parent.circulating > 0 && parent.bridgedAmount != null
				? Math.min(100, (parent.bridgedAmount / parent.circulating) * 100)
				: null
		const bridgeIds = parentBridges ? Object.keys(parentBridges) : []
		if (!parentBridges || bridgeIds.length === 0) {
			finalData[parent.name] = {
				...parent,
				bridgedPercent: percentBridged,
				bridgeInfo: {
					name: '-'
				}
			}
		} else {
			const parentFirstBridgeID = bridgeIds[0]!
			const parentFirstBridgeInfo = bridgeInfoObject[parentFirstBridgeID] ?? { name: 'not-found' }
			const parentFirstBridgeAmounts = parentBridges[parentFirstBridgeID] ?? []
			if (
				bridgeIds.length === 1 &&
				parentFirstBridgeAmounts.length === 1 &&
				parent.bridgedAmount != null &&
				parent.circulating != null &&
				parent.bridgedAmount === parent.circulating
			) {
				let childData: StablecoinUsageByChainRow
				const firstBridgeAmount = parentFirstBridgeAmounts[0]!
				const resolvedBridgeInfo =
					parentFirstBridgeInfo.name === 'Natively Issued'
						? { ...parentFirstBridgeInfo, name: '-' }
						: parentFirstBridgeInfo
				if (parentFirstBridgeInfo.name === 'Natively Issued') {
					childData = {
						...parent,
						bridgeInfo: resolvedBridgeInfo,
						bridgedPercent: percentBridged,
						name: `Natively Issued`
					}
				} else {
					childData = {
						...parent,
						bridgeInfo: resolvedBridgeInfo,
						bridgedPercent: percentBridged,
						name: firstBridgeAmount.sourceChain
							? `Bridged from ${capitalizeFirstLetter(firstBridgeAmount.sourceChain)}`
							: 'Bridged'
					}
				}
				finalData[parent.name] = {
					...parent,
					bridgeInfo: resolvedBridgeInfo,
					bridgedPercent: percentBridged,
					subRows: [childData]
				}
			} else {
				let totalBridged = 0
				for (const bridgeId of bridgeIds) {
					for (const bridgeAmount of parentBridges[bridgeId] ?? []) totalBridged += bridgeAmount.amount
				}
				for (const bridgeId of bridgeIds) {
					for (const bridgeAmount of parentBridges[bridgeId] ?? []) {
						const bridgeInfo = bridgeInfoObject[bridgeId] ?? {
							name: 'not-found'
						}
						const subChains = finalData[parent.name]?.subRows || []
						const parentAmountBridged = bridgeAmount.amount
						const percentBridgedBreakdown =
							percentBridged == null
								? null
								: totalBridged > 0
									? (parentAmountBridged / totalBridged) * percentBridged
									: 0

						const childData = {
							...parent,
							name: bridgeAmount.sourceChain
								? `Bridged from ${capitalizeFirstLetter(bridgeAmount.sourceChain)}`
								: 'Bridged',
							bridgeInfo,
							bridgedAmount: parentAmountBridged,
							bridgedPercent: percentBridgedBreakdown,
							circulating: parentAmountBridged,
							change_1d: null,
							change_7d: null,
							change_1m: null
						}
						finalData[parent.name] = {
							...parent,
							bridgedPercent: percentBridged,
							bridgeInfo: {
								name: '-'
							},
							subRows: [...subChains, childData]
						}
					}
				}
			}
		}
	}
	const finalDataArray: Array<(typeof finalData)[string]> = []
	for (const key in finalData) {
		const row = finalData[key]
		if (row?.name) {
			finalDataArray.push(row)
		}
	}
	return finalDataArray.sort((a, b) => (b.circulating ?? 0) - (a.circulating ?? 0))
}

export const useGroupBridgeData = (
	chains: Array<GroupBridgeDataInput>,
	bridgeInfoObject: BridgeInfo
): Array<StablecoinUsageByChainRow> => {
	return useMemo(() => groupBridgeData(chains, bridgeInfoObject), [chains, bridgeInfoObject])
}
