import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import type {
	DimensionDatasetProtocol,
	DimensionDatasetResult,
	DimensionDatasetType
} from '~/containers/AdapterMetrics/datasetTypes'
import {
	createDimensionDatasetRequestScope,
	fetchDimensionDataset,
	getDimensionDatasetSpec,
	type DimensionDatasetRequestScope
} from '~/containers/AdapterMetrics/server/datasets'
import type {
	ProtocolMembershipBaseFamily,
	ProtocolRowMembership
} from '~/containers/ProDashboard/unifiedTable/config/protocolRowMembership'
import type { ProtocolTableSourceRow } from '~/containers/ProDashboard/unifiedTable/contracts'
import { slug } from '~/utils'
import { toInternalSlug } from '~/utils/chainNormalizer'

type ProtocolMembershipScope = { kind: 'protocol' } | { kind: 'chain'; chains: string[] }

function getDimensionDatasetType(family: ProtocolMembershipBaseFamily): DimensionDatasetType | null {
	switch (family) {
		case 'fees':
			return 'fees'
		case 'holder-revenue':
			return 'holders-revenue'
		case 'dex-volume':
			return 'dexs'
		case 'perps-volume':
			return 'perps'
		case 'open-interest':
			return null
		case 'revenue':
			return 'revenue'
		case 'aggregator-volume':
			return 'aggregators'
		case 'options-volume':
			return 'options'
		default:
			return family satisfies never
	}
}

export async function fetchProtocolRowMembershipDataset(
	membership: ProtocolRowMembership,
	scope: ProtocolMembershipScope,
	requestScope: DimensionDatasetRequestScope = createDimensionDatasetRequestScope()
): Promise<DimensionDatasetResult | null> {
	if (membership.kind === 'all-protocols') return null

	let datasetType: DimensionDatasetType | null
	if (membership.kind === 'supplemental-metric') {
		datasetType = membership.metric === 'earnings' ? 'earnings' : 'bridge-aggregators'
	} else {
		datasetType = getDimensionDatasetType(membership.family)
	}

	const chainOptions = scope.kind === 'chain' && scope.chains.length > 0 ? { chains: scope.chains } : {}
	if (datasetType !== null) {
		const spec = getDimensionDatasetSpec(datasetType)
		const dataset = await fetchDimensionDataset({ ...spec.options, ...chainOptions }, requestScope)
		if (dataset.status === 'partial') {
			throw new Error(`Canonical ${datasetType} membership is unavailable for: ${dataset.unavailableChains.join(', ')}`)
		}
		return dataset
	}

	const dataset = await fetchDimensionDataset(
		{
			adapterType: ADAPTER_TYPES.OPEN_INTEREST,
			route: 'open-interest',
			metricName: 'Open Interest',
			dataType: ADAPTER_DATA_TYPES.OPEN_INTEREST_AT_END,
			...chainOptions
		},
		requestScope
	)
	if (dataset.status === 'partial') {
		throw new Error(`Canonical open-interest membership is unavailable for: ${dataset.unavailableChains.join(', ')}`)
	}
	return dataset
}

function toDatasetKey(protocol: DimensionDatasetProtocol): string {
	return slug(protocol.slug ?? protocol.name)
}

export function filterProtocolRowsByDatasetMembership(
	rows: ProtocolTableSourceRow[],
	dataset: DimensionDatasetResult | null
): ProtocolTableSourceRow[] {
	if (dataset === null) return rows

	const canonicalProtocolIds = new Set<string>()
	const canonicalChainsByProtocolId = new Map<string, Set<string>>()
	for (const protocol of dataset.protocols) {
		const protocolId = toDatasetKey(protocol)
		canonicalProtocolIds.add(protocolId)
		const chains = new Set<string>()
		for (const chainName of protocol.chains) chains.add(toInternalSlug(chainName))
		canonicalChainsByProtocolId.set(protocolId, chains)
	}

	return rows.filter((row) => {
		const directMember = canonicalProtocolIds.has(row.protocolId)
		const parentId = row.parentProtocolId
		const parentMember = parentId !== null && canonicalProtocolIds.has(parentId)
		if (!row.chain) return directMember || parentMember

		const chainSlug = toInternalSlug(row.chain)
		return (
			(directMember && canonicalChainsByProtocolId.get(row.protocolId)?.has(chainSlug) === true) ||
			(parentMember && canonicalChainsByProtocolId.get(parentId)?.has(chainSlug) === true)
		)
	})
}
