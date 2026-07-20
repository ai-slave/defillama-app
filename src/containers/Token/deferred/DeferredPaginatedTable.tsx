import { lazy } from 'react'

export const DeferredPaginatedTable = lazy(() =>
	import('~/components/Table/PaginatedTable').then((module) => ({ default: module.PaginatedTable }))
) as typeof import('~/components/Table/PaginatedTable').PaginatedTable
