import { lazy } from 'react'

export const DeferredPairTable = lazy(() =>
	import('~/containers/Exchanges/PairTable').then((module) => ({ default: module.PairTable }))
) as typeof import('~/containers/Exchanges/PairTable').PairTable
