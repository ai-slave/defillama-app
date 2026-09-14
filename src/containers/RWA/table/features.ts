import { createExpandedRowModel, rowExpandingFeature, tableFeatures } from '@tanstack/react-table'
import { displayTableFeatures } from '~/components/Table/features/display'

/** Sorting, sizing and visibility from the site's display tables, plus the group rows that expand. */
export const rwaTableFeatures = tableFeatures({
	...displayTableFeatures,
	rowExpandingFeature,
	expandedRowModel: createExpandedRowModel()
})

export type RwaTableFeatures = typeof rwaTableFeatures
