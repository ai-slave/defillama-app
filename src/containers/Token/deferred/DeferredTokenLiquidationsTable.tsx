import { lazy } from 'react'

export const DeferredTokenLiquidationsTable = lazy(() =>
	import('../TokenLiquidationsTable').then((module) => ({ default: module.TokenLiquidationsTable }))
) as typeof import('../TokenLiquidationsTable').TokenLiquidationsTable
