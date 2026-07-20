import { lazy } from 'react'

export const DeferredPaginatedYieldsPoolTable = lazy(() =>
	import('~/containers/Yields/Tables/Pools').then((module) => ({ default: module.PaginatedYieldsPoolTable }))
) as typeof import('~/containers/Yields/Tables/Pools').PaginatedYieldsPoolTable
