import { useMemo } from 'react'
import { tvlOptionsMap } from '~/components/Filters/options'
import { isTvlSettingsKey, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import type { IProtocolOverviewPageData } from './types'

type ToggleOption = { name: string; key: string }

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
		if (isTvlSettingsKey(chain)) {
			const option = tvlOptionsMap.get(chain)
			if (option) {
				pushToggleOption(toggleOptions, option)
			}
			continue
		}

		const lastIndex = chain.lastIndexOf('-')
		const extraTvlKey = lastIndex === -1 ? undefined : chain.slice(lastIndex + 1)
		const normalizedExtraKey = extraTvlKey?.toLowerCase()
		const hasRecognizedExtraTvl = normalizedExtraKey != null && isTvlSettingsKey(normalizedExtraKey)

		// Preserve chain names that contain hyphens unless the suffix is a known extra-TVL key.
		if (!hasRecognizedExtraTvl) {
			const value = source[chain]
			destination[chain] = (destination[chain] ?? 0) + value
			total += value
			continue
		}

		const chainName = chain.slice(0, lastIndex)
		const extraOption = tvlOptionsMap.get(normalizedExtraKey)
		if (extraOption) {
			pushToggleOption(toggleOptions, extraOption)
		}
		if (extraTvlsEnabled[normalizedExtraKey]) {
			const value = source[chain]
			destination[chainName] = (destination[chainName] ?? 0) + value
			total += value
		}
	}
	return total
}

const getSortedChainValues = (valuesByChain: Record<string, number>): Array<[string, number]> => {
	const values: Array<[string, number]> = []
	for (const chain in valuesByChain) {
		values.push([chain, valuesByChain[chain]])
	}
	values.sort((a, b) => b[1] - a[1])
	return values
}

export const useFinalTVL = (props: IProtocolOverviewPageData) => {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')

	return useMemo(() => {
		const tvlByChainMap: Record<string, number> = {}
		const toggleOptions: ToggleOption[] = []
		const oracleTvsByChainMap: Record<string, number> = {}

		const currentTvlByChain = props.currentTvlByChain ?? {}
		const tvl = aggregateTvlByChain({
			source: currentTvlByChain,
			destination: tvlByChainMap,
			extraTvlsEnabled,
			toggleOptions
		})

		const oracleTvsData = props.oracleTvs ?? {}
		const oracleTvs = aggregateTvlByChain({
			source: oracleTvsData,
			destination: oracleTvsByChainMap,
			extraTvlsEnabled,
			toggleOptions
		})

		return {
			tvl,
			tvlByChain: getSortedChainValues(tvlByChainMap),
			oracleTvs,
			oracleTvsByChain: getSortedChainValues(oracleTvsByChainMap),
			toggleOptions
		}
	}, [extraTvlsEnabled, props.currentTvlByChain, props.oracleTvs])
}

export const getPrimaryValueLabelType = (category: string) => {
	switch (category) {
		case 'CEX':
			return { title: 'Total Assets', byChainTitle: 'Total Assets by Chain', dataType: 'TotalAssets' }
		case 'Oracle':
			return { title: 'Total Value Secured', byChainTitle: 'TVS by Chain', dataType: 'TVS' }
		default:
			return { title: 'Total Value Locked', byChainTitle: 'TVL by Chain', dataType: 'TVL' }
	}
}
