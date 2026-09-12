import { columnOrderingFeature, tableFeatures } from '@tanstack/react-table'
import { expandedFilteredTableFeatures } from './expandedFiltering'

export const searchTableFeatures = tableFeatures({
	...expandedFilteredTableFeatures,
	columnOrderingFeature
})

export type SearchTableFeatures = typeof searchTableFeatures
