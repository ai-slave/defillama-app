import { useCallback, useMemo, useState } from 'react'
import { normalizeChartBuilderConfig } from '../../chartBuilderCapabilities'
import { isChainTokenChartType } from '../../chartSource'
import { createChartConfig } from '../../dashboardConfig/classicChartConfig'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { requestDashboardItemReveal } from '../../hooks/useDashboardItemDeepLink'
import { useProDashboardCatalog, useProDashboardEditorActions, useProDashboardTime } from '../../ProDashboardAPIContext'
import {
	type Chain,
	CHART_TYPES,
	type ChartConfig,
	MAX_MULTI_CHART_SERIES,
	type Protocol,
	isProDashboardChartType
} from '../../types'
import type { DashboardItemPlacement } from '../../useDashboardActions'
import { EXTENDED_COLOR_PALETTE } from '../../utils/colorManager'
import { generateItemId } from '../../utils/dashboardUtils'
import { buildEditedDashboardItem, buildNewDashboardItems } from './modalSubmissions'
import type { ChartBuilderUpdate, ChartTabType, MainTabType, ModalState } from './types'
import { useModalState } from './useModalState'

export function useModalActions(
	editItem: DashboardItemConfig | null | undefined,
	onClose: () => void,
	placement?: DashboardItemPlacement | undefined,
	draftItem?: DashboardItemConfig | null | undefined
) {
	const { protocols, chains, protocolsLoading } = useProDashboardCatalog()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { handleAppendItems, handleEditItem } = useProDashboardEditorActions()

	const { state, actions } = useModalState(editItem, draftItem)

	const chainOptions = useMemo(
		() => [
			{ value: 'All', label: 'All chains' },
			...chains.map((chain: Chain) => ({
				value: chain.name,
				label: chain.name
			}))
		],
		[chains]
	)

	const protocolOptions = useMemo(() => {
		const childrenByParentId = new Map<string, Array<Protocol>>()
		const parentsOrSolo: Array<Protocol> = []

		for (const p of protocols) {
			if (p.parentProtocol) {
				const arr = childrenByParentId.get(p.parentProtocol) || []
				arr.push(p)
				childrenByParentId.set(p.parentProtocol, arr)
			} else {
				parentsOrSolo.push(p)
			}
		}

		parentsOrSolo.sort((a, b) => b.tvl - a.tvl)

		const options: Array<{ value: string; label: string; logo?: string; isChild?: boolean; parentValue?: string }> = []

		for (const parent of parentsOrSolo) {
			options.push({ value: parent.slug, label: parent.name, ...(parent.logo ? { logo: parent.logo } : {}) })
			const children = childrenByParentId.get(parent.id) || []
			if (children.length > 0) {
				children.sort((a, b) => b.tvl - a.tvl)
				for (const child of children) {
					options.push({
						value: child.slug,
						label: child.name,
						...(child.logo ? { logo: child.logo } : {}),
						isChild: true,
						parentValue: parent.slug
					})
				}
			}
		}

		return options
	}, [protocols])

	const handleTokensChange = useCallback(
		(tokens: Array<string>) => {
			if (tokens.length <= 4) {
				actions.setSelectedTokens(tokens)
			}
		},
		[actions]
	)

	const handleAddToComposer = useCallback(
		(typesToAdd?: Array<string>, options?: { entity?: string; mode?: 'chain' | 'protocol' }) => {
			const incomingTypes = typesToAdd ?? state.selectedChartTypes
			const uniqueChartTypes = Array.from(new Set(incomingTypes))
			let addedCount = 0

			const resolveTargetGrouping = (): ChartConfig['grouping'] => {
				if (state.chartCreationMode !== 'combined') {
					return 'day'
				}

				const existingGroupings = state.composerItems
					.map((item) => item.grouping)
					.filter((grouping): grouping is NonNullable<typeof grouping> => Boolean(grouping))

				if (existingGroupings.length === 0) {
					return 'day'
				}

				const [firstGrouping] = existingGroupings
				const allMatch = existingGroupings.every((grouping) => grouping === firstGrouping)

				return allMatch ? firstGrouping : 'day'
			}

			const targetGrouping = resolveTargetGrouping()
			const getNextColorIndex = () => state.composerItems.length

			const effectiveMode = options?.mode ?? state.selectedChartTab

			if (effectiveMode === 'chain' && uniqueChartTypes.length > 0) {
				const chainsToUse = options?.entity
					? [options.entity]
					: state.selectedChains.length > 0
						? state.selectedChains
						: state.selectedChain
							? [state.selectedChain]
							: []
				for (const chainName of chainsToUse) {
					const remainingSlots = MAX_MULTI_CHART_SERIES - state.composerItems.length - addedCount
					if (remainingSlots <= 0) break
					const chain = chains.find((c: Chain) => c.name === chainName)
					const filteredTypes = uniqueChartTypes.filter((chartType) => {
						return !state.composerItems.some(
							(item) => item.subjectType === 'chain' && item.chain === chainName && item.type === chartType
						)
					})
					if (filteredTypes.length > 0) {
						const colorStartIndex = getNextColorIndex() + addedCount
						const newCharts: Array<ChartConfig> = []
						for (const [idx, chartType] of filteredTypes.slice(0, remainingSlots).entries()) {
							const color = EXTENDED_COLOR_PALETTE[(colorStartIndex + idx) % EXTENDED_COLOR_PALETTE.length]
							const geckoId = isChainTokenChartType(chartType) ? chain?.gecko_id : undefined
							const chart = createChartConfig({
								id: `${chainName}-${chartType}-${Date.now()}-${Math.random()}`,
								kind: 'chart',
								subjectType: 'chain',
								chain: chainName,
								type: chartType,
								...(targetGrouping ? { grouping: targetGrouping } : {}),
								...(geckoId === undefined ? {} : { geckoId }),
								...(color ? { color } : {})
							})
							if (chart) newCharts.push(chart)
						}
						actions.setComposerItems((prev) => [...prev, ...newCharts])
						addedCount += newCharts.length
					}
				}
			} else if (effectiveMode === 'protocol' && uniqueChartTypes.length > 0) {
				const protocolsToUse = options?.entity
					? [options.entity]
					: state.selectedProtocols && state.selectedProtocols.length > 0
						? state.selectedProtocols
						: state.selectedProtocol
							? [state.selectedProtocol]
							: []
				for (const slug of protocolsToUse) {
					const remainingSlots = MAX_MULTI_CHART_SERIES - state.composerItems.length - addedCount
					if (remainingSlots <= 0) break
					const protocol = protocols.find((p: Protocol) => p.slug === slug)
					const filteredTypes = uniqueChartTypes.filter((chartType) => {
						return !state.composerItems.some(
							(item) => item.subjectType === 'protocol' && item.protocol === slug && item.type === chartType
						)
					})
					if (filteredTypes.length > 0) {
						const colorStartIndex = getNextColorIndex() + addedCount
						const newCharts: Array<ChartConfig> = []
						for (const [idx, chartType] of filteredTypes.slice(0, remainingSlots).entries()) {
							const color = EXTENDED_COLOR_PALETTE[(colorStartIndex + idx) % EXTENDED_COLOR_PALETTE.length]
							const chart = createChartConfig({
								id: `${slug}-${chartType}-${Date.now()}-${Math.random()}`,
								kind: 'chart',
								subjectType: 'protocol',
								protocol: slug,
								type: chartType,
								...(targetGrouping ? { grouping: targetGrouping } : {}),
								...(protocol?.geckoId === undefined ? {} : { geckoId: protocol.geckoId }),
								...(color ? { color } : {}),
								...(chartType === 'unlocks' ? { dataType: 'documented' } : {})
							})
							if (chart) newCharts.push(chart)
						}
						actions.setComposerItems((prev) => [...prev, ...newCharts])
						addedCount += newCharts.length
					}
				}
			}
		},
		[
			actions,
			chains,
			protocols,
			state.composerItems,
			state.selectedChain,
			state.selectedChains,
			state.selectedChartTab,
			state.selectedChartTypes,
			state.selectedProtocol,
			state.selectedProtocols,
			state.chartCreationMode
		]
	)

	const handleRemoveFromComposer = useCallback(
		(id: string) => {
			actions.setComposerItems((prev) => prev.filter((item) => item.id !== id))
		},
		[actions]
	)

	const handleUpdateComposerItemColor = useCallback(
		(id: string, color: string) => {
			actions.setComposerItems((prev) => prev.map((item) => (item.id === id ? { ...item, color } : item)))
		},
		[actions]
	)

	const handleBulkChartTypeChange = useCallback(
		(nextType: string) => {
			if (!isProDashboardChartType(nextType)) return
			actions.setComposerItems((prev) =>
				prev.map((item) => {
					const chartTypeConfig = CHART_TYPES[nextType]
					const isGroupable = 'groupable' in chartTypeConfig && chartTypeConfig.groupable
					let geckoId: string | null | undefined
					if (item.subjectType === 'chain') {
						const chain = chains.find((c: Chain) => c.name === item.chain)
						geckoId = isChainTokenChartType(nextType) ? chain?.gecko_id : undefined
					} else {
						const protocol = protocols.find((p: Protocol) => p.slug === item.protocol)
						geckoId = protocol?.geckoId
					}
					const chart = createChartConfig({
						...item,
						type: nextType,
						...(geckoId === undefined ? {} : { geckoId }),
						...(nextType === 'unlocks' ? { dataType: 'documented' } : {}),
						...(isGroupable && item.grouping ? { grouping: item.grouping } : {})
					})
					return chart ?? item
				})
			)
			actions.setSelectedChartType(nextType)
			actions.setSelectedChartTypes([nextType])
		},
		[actions, chains, protocols]
	)

	const handleMainTabChange = useCallback(
		(tab: MainTabType) => {
			actions.setSelectedMainTab(tab)
			actions.setSelectedChain(null)
			actions.setSelectedProtocol(null)
			actions.setSelectedChartType('tvl')
			actions.setSelectedChartTypes([])
			if (tab === 'charts' && state.chartMode === 'manual') {
				actions.setUnifiedChartName('')
			}
		},
		[actions, state.chartMode]
	)

	const handleChartTabChange = useCallback(
		(tab: ChartTabType) => {
			actions.setSelectedChartTab(tab)
			actions.setSelectedChain(null)
			actions.setSelectedProtocol(null)
			if (tab === 'unlocks') {
				actions.setSelectedUnlocksProtocol(null)
				actions.setSelectedUnlocksProtocolName(null)
				actions.setSelectedUnlocksChartType('total')
			}
		},
		[actions]
	)

	const handleSelectChartCategory = useCallback(
		(tab: ChartTabType) => {
			handleChartTabChange(tab)
			actions.setManualFormOpen(true)
		},
		[actions, handleChartTabChange]
	)

	const handleBackToChartCategories = useCallback(() => {
		actions.setManualFormOpen(false)
	}, [actions])

	const updateChartBuilder = useCallback(
		(updates: ChartBuilderUpdate) => {
			actions.setChartBuilder((prev) => {
				const { protocol, protocolCategories, ...ordinaryUpdates } = updates
				const next = { ...prev, ...ordinaryUpdates }
				if ('protocol' in updates) {
					if (protocol === undefined) delete next.protocol
					else next.protocol = protocol
				}
				if ('protocolCategories' in updates) {
					if (protocolCategories === undefined) delete next.protocolCategories
					else next.protocolCategories = protocolCategories
				}
				return normalizeChartBuilderConfig(next)
			})
		},
		[actions]
	)

	// A refused add or edit says why beside the button, for as long as the form is the one that was refused.
	const [rejection, setRejection] = useState<{ state: ModalState; reason: string } | null>(null)
	const submitError = rejection?.state === state ? rejection.reason : null

	const handleSubmit = useCallback(() => {
		let appendedIds: Array<string> = []
		if (editItem) {
			const newItem = buildEditedDashboardItem({ editItem, state, protocols, chains })
			const edited = newItem ? handleEditItem(editItem.id, newItem) : null
			if (edited?.status === 'refused') {
				setRejection({ state, reason: edited.reason })
				return
			}
		} else {
			const appended = handleAppendItems(
				(existingItems) =>
					buildNewDashboardItems({ state, protocols, chains, existingItems, idFactory: generateItemId }),
				placement
			)
			if (appended.status === 'refused') {
				setRejection({ state, reason: appended.reason })
				return
			}
			appendedIds = appended.ids
		}

		onClose()
		const revealId = appendedIds[0]
		if (revealId) requestDashboardItemReveal(revealId)
	}, [editItem, state, chains, protocols, handleEditItem, handleAppendItems, onClose, placement])

	const uiActions = useMemo(
		() => ({
			...actions,
			handleTokensChange,
			handleAddToComposer,
			handleRemoveFromComposer,
			handleUpdateComposerItemColor,
			handleBulkChartTypeChange,
			handleMainTabChange,
			handleChartTabChange,
			handleSelectChartCategory,
			handleBackToChartCategories,
			handleSubmit,
			updateChartBuilder
		}),
		[
			actions,
			handleTokensChange,
			handleAddToComposer,
			handleRemoveFromComposer,
			handleUpdateComposerItemColor,
			handleBulkChartTypeChange,
			handleMainTabChange,
			handleChartTabChange,
			handleSelectChartCategory,
			handleBackToChartCategories,
			handleSubmit,
			updateChartBuilder
		]
	)

	const computed = useMemo(
		() => ({
			chainOptions,
			protocolOptions,
			protocolsLoading,
			timePeriod,
			customTimePeriod
		}),
		[chainOptions, protocolOptions, protocolsLoading, timePeriod, customTimePeriod]
	)

	return {
		state,
		actions: uiActions,
		computed,
		submitError
	}
}
