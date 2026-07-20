import { lazy } from 'react'

export const DeferredPaginatedBorrowRoutesTable = lazy(() =>
	import('~/containers/Yields/Tables/Borrow').then((module) => ({ default: module.PaginatedBorrowRoutesTable }))
) as typeof import('~/containers/Yields/Tables/Borrow').PaginatedBorrowRoutesTable
