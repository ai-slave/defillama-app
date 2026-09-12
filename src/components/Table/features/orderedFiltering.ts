import { columnOrderingFeature, tableFeatures } from '@tanstack/react-table'
import { filteredTableFeatures } from './filtering'

export const orderedFilteredTableFeatures = tableFeatures({
	...filteredTableFeatures,
	columnOrderingFeature
})
