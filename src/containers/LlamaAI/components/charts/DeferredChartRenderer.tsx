import { lazy } from 'react'

export const DeferredChartRenderer = lazy(() =>
	import('./ChartRenderer').then((module) => ({
		default: module.ChartRenderer
	}))
)
