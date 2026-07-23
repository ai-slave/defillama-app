import { useMemo } from 'react'
import {
	isTvlSettingsKey,
	type TvlSettingsKey,
	updateAllSettingsInLsAndUrl,
	useLocalStorageSettingsManager
} from '~/contexts/LocalStorage'

export function useProtocolsFilterState(options: { key: string; name: string }[]) {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')

	const selectedValues = useMemo<string[]>(() => {
		const filters = options.flatMap((o) => (isTvlSettingsKey(o.key) ? [o.key] : []))
		return filters.filter((key) => extraTvlsEnabled[key])
	}, [extraTvlsEnabled, options])

	const setSelectedValues = (values: string[]) => {
		const newValues: Partial<Record<TvlSettingsKey, boolean>> = {}
		const selectedValuesSet = new Set(values)
		for (const o of options) {
			if (!isTvlSettingsKey(o.key)) continue
			newValues[o.key] = selectedValuesSet.has(o.key)
		}
		updateAllSettingsInLsAndUrl(newValues)
	}

	return { selectedValues, setSelectedValues }
}
