import { lazy } from 'react'

export const DeferredTokenMarketsTable = lazy(() =>
	import('../TokenMarketsTable').then((module) => ({ default: module.TokenMarketsTable }))
)
