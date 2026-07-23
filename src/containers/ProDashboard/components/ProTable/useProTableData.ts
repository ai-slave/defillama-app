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
	const { data: chainProtocolsEarnings } = useGetProtocolsEarningsByMultiChain(chains, sourcePlan.enabled.earnings)
	const { data: chainProtocolsAggregators } = useGetProtocolsAggregatorsByMultiChain(
		chains,
		sourcePlan.enabled.aggregators
	)
	const { data: chainProtocolsBridgeAggregators } = useGetProtocolsBridgeAggregatorsByMultiChain(
		chains,
		sourcePlan.enabled.bridgeAggregators
	)
	const { data: chainProtocolsOptions } = useGetProtocolsOptionsVolumeByMultiChain(chains, sourcePlan.enabled.options)

	const fullProtocolsList = React.useMemo(() => normalizeProtocolRows(rawProtocols), [rawProtocols])
	const parentProtocols = React.useMemo(() => normalizeParentProtocols(rawParentProtocols), [rawParentProtocols])
	const isLoading = isLoadingProtocols
	const isEmptyProtocols = !isLoading && fullProtocolsList.length === 0

	const finalProtocolsList = React.useMemo(() => {
		return prepareProTableRows({
			protocols: fullProtocolsList,
			parentProtocols,
			filters,
			sourcePlan,
			volumeData: chainProtocolsVolumes,
			feesData: chainProtocolsFees,
			perpsData: chainProtocolsPerps,
			openInterestData: chainProtocolsOpenInterest,
			earningsData: chainProtocolsEarnings,
			aggregatorsData: chainProtocolsAggregators,
			bridgeAggregatorsData: chainProtocolsBridgeAggregators,
			optionsData: chainProtocolsOptions
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
		categories,
		availableProtocols,
		parentProtocols,
		searchIndex
	}
}
