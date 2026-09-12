import { createExpandedRowModel, rowExpandingFeature, tableFeatures } from '@tanstack/react-table'
import { filteredTableFeatures } from './filtering'

export const expandedFilteredTableFeatures = tableFeatures({
	...filteredTableFeatures,
	rowExpandingFeature,
	expandedRowModel: createExpandedRowModel()
})
