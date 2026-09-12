import {
	columnFilteringFeature,
	createFilteredRowModel,
	filterFn_includesString,
	filterFn_inNumberRange,
	tableFeatures
} from '@tanstack/react-table'
import { displayTableFeatures } from './display'

export const filteredTableFeatures = tableFeatures({
	...displayTableFeatures,
	columnFilteringFeature,
	filteredRowModel: createFilteredRowModel(),
	filterFns: { includesString: filterFn_includesString, inNumberRange: filterFn_inNumberRange }
})
