import { useMemo } from 'react'
import { tvlOptionsMap } from '~/components/Filters/options'
import { isTvlSettingsKey, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { isProtocolExtraTvlKey, type ProtocolExtraTvlKey } from './tvlChart'
import type { IProtocolOverviewPageData } from './types'

type ToggleOption = { name: string; key: ProtocolExtraTvlKey }

const pushToggleOption = (toggleOptions: ToggleOption[], option: ToggleOption) => {
	if (!toggleOptions.some((item) => item.key === option.key)) {
		toggleOptions.push(option)
	}
}

const aggregateTvlByChain = ({
	source,
	destination,
	extraTvlsEnabled,
	toggleOptions
}: {
	source: Record<string, number>
	destination: Record<string, number>
	extraTvlsEnabled: Record<string, boolean>
	toggleOptions: ToggleOption[]
}): number => {
	let total = 0
	for (const chain in source) {
		const value = source[chain]
		if (value === undefined) continue
		if (isTvlSettingsKey(chain)) {
			if (isProtocolExtraTvlKey(chain)) {
				const option = tvlOptionsMap.get(chain)
				if (option) pushToggleOption(toggleOptions, { name: option.name, key: chain })
			}
			continue
		}

		const lastIndex = chain.lastIndexOf('-')
		const extraTvlKey = lastIndex === -1 ? undefined : chain.slice(lastIndex + 1)
		const normalizedExtraKey = extraTvlKey?.toLowerCase()
		const hasRecognizedExtraTvl = normalizedExtraKey != null && isTvlSettingsKey(normalizedExtraKey)

		// Preserve chain names that contain hyphens unless the suffix is a known extra-TVL key.
		if (!hasRecognizedExtraTvl) {
			destination[chain] = (destination[chain] ?? 0) + value
			total += value
			continue
		}
		if (!isProtocolExtraTvlKey(normalizedExtraKey)) continue

		const chainName = chain.slice(0, lastIndex)
		const extraOption = tvlOptionsMap.get(normalizedExtraKey)
		if (extraOption) pushToggleOption(toggleOptions, { name: extraOption.name, key: normalizedExtraKey })
		if (extraTvlsEnabled[normalizedExtraKey]) {
			destination[chainName] = (destination[chainName] ?? 0) + value
			total += value
		}
	}
	return total
}

const getSortedChainValues = (valuesByChain: Record<string, number>): Array<[string, number]> => {
	const values: Array<[string, number]> = []
	for (const chain in valuesByChain) {
		const value = valuesByChain[chain]
		if (value !== undefined) values.push([chain, value])
	}
	values.sort((a, b) => b[1] - a[1])
	return values
}

export const useFinalTVL = (props: Pick<IProtocolOverviewPageData, 'currentTvlByChain' | 'oracleTvs'>) => {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')

	return useMemo(() => {
		const tvlByChainMap: Record<string, number> = {}
		const toggleOptions: ToggleOption[] = []
		const oracleTvsByChainMap: Record<string, number> = {}

		const tvl = props.currentTvlByChain
			? aggregateTvlByChain({
					source: props.currentTvlByChain,
					destination: tvlByChainMap,
					extraTvlsEnabled,
					toggleOptions
				})
			: 0

		const oracleTvs = props.oracleTvs
			? aggregateTvlByChain({
					source: props.oracleTvs,
					destination: oracleTvsByChainMap,
					extraTvlsEnabled,
					toggleOptions
				})
			: null

		return {
			tvl,
			tvlByChain: getSortedChainValues(tvlByChainMap),
			oracleTvs,
			oracleTvsByChain: getSortedChainValues(oracleTvsByChainMap),
			toggleOptions
		}
	}, [extraTvlsEnabled, props.currentTvlByChain, props.oracleTvs])
}

export const getPrimaryValueLabelType = (category: string | null | undefined) => {
	switch (category) {
		case 'CEX':
			return { title: 'Total Assets', byChainTitle: 'Total Assets by Chain', dataType: 'TotalAssets' }
		case 'Oracle':
			return { title: 'Total Value Secured', byChainTitle: 'TVS by Chain', dataType: 'TVS' }
		default:
			return { title: 'Total Value Locked', byChainTitle: 'TVL by Chain', dataType: 'TVL' }
	}
}
