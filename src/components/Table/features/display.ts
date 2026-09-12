import { columnSizingFeature, columnVisibilityFeature, tableFeatures } from '@tanstack/react-table'
import { sortedTableFeatures } from './sorting'

export const displayTableFeatures = tableFeatures({
	...sortedTableFeatures,
	columnSizingFeature,
	columnVisibilityFeature
})
