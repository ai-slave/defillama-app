'use no memo'

import * as React from 'react'
import type { IParentProtocol } from '~/containers/ProtocolLists/protocol-table.types'
import type { IProtocolRow, UseProTableDataParams, UseProTableDataResult } from './proTable.types'
import { createProTableSearchIndex, prepareProTableRows } from './proTablePreparation'
import {
	useGetProtocolsAggregatorsByMultiChain,
	useGetProtocolsBridgeAggregatorsByMultiChain,
	useGetProtocolsEarningsByMultiChain,
	useGetProtocolsFeesAndRevenueByMultiChain,
	useGetProtocolsListMultiChain,
	useGetProtocolsOpenInterestByMultiChain,
	useGetProtocolsOptionsVolumeByMultiChain,
	useGetProtocolsPerpsVolumeByMultiChain,
	useGetProtocolsVolumeByMultiChain
} from './useProTableMultiChain'

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const normalizeProtocolRows = (value: unknown): IProtocolRow[] => {
	if (!Array.isArray(value)) return []
	return value.filter((row): row is IProtocolRow => isObject(row) && typeof row.name === 'string')
}

const normalizeParentProtocols = (value: unknown): IParentProtocol[] => {
	if (!Array.isArray(value)) return []
	return value.filter(
		(parent): parent is IParentProtocol =>
			isObject(parent) && typeof parent.id === 'string' && typeof parent.name === 'string'
	)
}

export function useProTableData({ chains, filters, sourcePlan }: UseProTableDataParams): UseProTableDataResult {
	const {
		fullProtocolsList: rawProtocols,
		parentProtocols: rawParentProtocols,
		isLoading: isLoadingProtocols
	} = useGetProtocolsListMultiChain(chains, sourcePlan.enabled.protocols)
	const { data: chainProtocolsVolumes } = useGetProtocolsVolumeByMultiChain(chains, sourcePlan.enabled.volume)
	const { data: chainProtocolsFees } = useGetProtocolsFeesAndRevenueByMultiChain(chains, sourcePlan.enabled.fees)
	const { data: chainProtocolsPerps } = useGetProtocolsPerpsVolumeByMultiChain(chains, sourcePlan.enabled.perps)
	const { data: chainProtocolsOpenInterest } = useGetProtocolsOpenInterestByMultiChain(
		chains,
		sourcePlan.enabled.openInterest
	)
	const { data: chainProtocolsEarnings, unavailableChains: earningsUnavailableChains } =
		useGetProtocolsEarningsByMultiChain(chains, sourcePlan.enabled.earnings)
	const { data: chainProtocolsAggregators, unavailableChains: aggregatorsUnavailableChains } =
		useGetProtocolsAggregatorsByMultiChain(chains, sourcePlan.enabled.aggregators)
	const { data: chainProtocolsBridgeAggregators, unavailableChains: bridgeAggregatorsUnavailableChains } =
		useGetProtocolsBridgeAggregatorsByMultiChain(chains, sourcePlan.enabled.bridgeAggregators)
	const { data: chainProtocolsOptions, unavailableChains: optionsUnavailableChains } =
		useGetProtocolsOptionsVolumeByMultiChain(chains, sourcePlan.enabled.options)
	const unavailableChains = Array.from(
		new Set([
			...earningsUnavailableChains,
			...aggregatorsUnavailableChains,
			...bridgeAggregatorsUnavailableChains,
			...optionsUnavailableChains
		])
	)

	const fullProtocolsList = React.useMemo(() => normalizeProtocolRows(rawProtocols), [rawProtocols])
	const parentProtocols = React.useMemo(() => normalizeParentProtocols(rawParentProtocols), [rawParentProtocols])
	const isLoading = isLoadingProtocols
	const isEmptyProtocols = !isLoading && fullProtocolsList.length === 0

	const finalProtocolsList = React.useMemo(() => {
		return prepareProTableRows({
			protocols: fullProtocolsList,
			parentProtocols,
			sourcePlan,
			...(filters !== undefined ? { filters } : {}),
			...(chainProtocolsVolumes !== undefined ? { volumeData: chainProtocolsVolumes } : {}),
			...(chainProtocolsFees !== undefined ? { feesData: chainProtocolsFees } : {}),
			...(chainProtocolsPerps !== undefined ? { perpsData: chainProtocolsPerps } : {}),
			...(chainProtocolsOpenInterest !== undefined ? { openInterestData: chainProtocolsOpenInterest } : {}),
			...(chainProtocolsEarnings !== undefined ? { earningsData: chainProtocolsEarnings } : {}),
			...(chainProtocolsAggregators !== undefined ? { aggregatorsData: chainProtocolsAggregators } : {}),
			...(chainProtocolsBridgeAggregators !== undefined
				? { bridgeAggregatorsData: chainProtocolsBridgeAggregators }
				: {}),
			...(chainProtocolsOptions !== undefined ? { optionsData: chainProtocolsOptions } : {})
		})
	}, [
		fullProtocolsList,
		parentProtocols,
		chainProtocolsVolumes,
		chainProtocolsFees,
		chainProtocolsPerps,
		chainProtocolsOpenInterest,
		chainProtocolsEarnings,
		chainProtocolsAggregators,
		chainProtocolsBridgeAggregators,
		chainProtocolsOptions,
		sourcePlan,
		filters
	])

	const categories = React.useMemo(() => {
		const uniqueCategories = new Set<string>()
		for (const protocol of fullProtocolsList) {
			if (protocol.category) uniqueCategories.add(protocol.category)
		}
		return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b))
	}, [fullProtocolsList])
	const availableProtocols = React.useMemo(
		() => fullProtocolsList.toSorted((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0)),
		[fullProtocolsList]
	)
	const searchIndex = React.useMemo(() => createProTableSearchIndex(finalProtocolsList), [finalProtocolsList])

	return {
		finalProtocolsList,
		isLoading,
		isEmptyProtocols,
		unavailableChains,
		categories,
		availableProtocols,
		parentProtocols,
		searchIndex
	}
}
