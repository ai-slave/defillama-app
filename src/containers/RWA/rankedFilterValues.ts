import type { IRWAAssetsOverview } from './api.types'

type RankedFilterOptions = Pick<
	IRWAAssetsOverview,
	'typeOptions' | 'categoriesOptions' | 'assetClassOptions' | 'rwaClassificationOptions' | 'accessModelOptions'
>

export function getRankedRwaFilterValues(options: RankedFilterOptions) {
	return {
		types: options.typeOptions.map((option) => option.key),
		categories: options.categoriesOptions.map((option) => option.key),
		assetClasses: options.assetClassOptions.map((option) => option.key),
		rwaClassifications: options.rwaClassificationOptions.map((option) => option.key),
		accessModels: options.accessModelOptions.map((option) => option.key)
	}
}
