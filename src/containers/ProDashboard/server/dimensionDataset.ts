import {
	fetchDimensionDataset,
	type DimensionDatasetResult,
	type DimensionDatasetSpec
} from '~/containers/AdapterMetrics/server/datasets'
import { slug } from '~/utils'
import type { IChainMetadata } from '~/utils/metadata/types'

const PRO_DATASET_CHAIN_GUARDS: Partial<Record<string, keyof IChainMetadata>> = {
	// Legacy `options` tables mean premium volume. Saved tables can contain chains
	// that never supported that metric, so do not send those chains upstream.
	options: 'optionsPremiumVolume'
}

export function filterProDimensionDatasetChains(
	spec: DimensionDatasetSpec,
	chains: string[],
	chainMetadata: Record<string, IChainMetadata>
): string[] {
	if (chains.length === 0 || chains.includes('All')) return chains
	const chainGuard = PRO_DATASET_CHAIN_GUARDS[spec.datasetType]
	if (!chainGuard) return chains
	return chains.filter((chain) => !!chainMetadata[slug(chain)]?.[chainGuard])
}

/** Pro-only compatibility planning around the canonical AdapterMetrics dataset fetcher. */
export async function fetchProDimensionDataset(
	spec: DimensionDatasetSpec,
	chains: string[]
): Promise<DimensionDatasetResult> {
	const metadata = await import('~/utils/metadata').then((module) => module.default)
	const supportedChains = filterProDimensionDatasetChains(spec, chains, metadata.chainMetadata)
	if (chains.length > 0 && !chains.includes('All') && supportedChains.length === 0) {
		return { status: 'complete', protocols: [] }
	}
	return fetchDimensionDataset({ ...spec.options, chains: supportedChains })
}
