import { createPaginatedRowModel, createTableHook, rowPaginationFeature, tableFeatures } from '@tanstack/react-table'
import { displayTableFeatures } from './display'

export const paginatedTableFeatures = tableFeatures({
	...displayTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

export const { useAppTable: usePaginatedTable } = createTableHook({ features: paginatedTableFeatures })
