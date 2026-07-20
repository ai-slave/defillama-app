import { lazy } from 'react'

export const DeferredTableWithSearch = lazy(() =>
	import('~/components/Table/TableWithSearch').then((module) => ({ default: module.TableWithSearch }))
) as typeof import('~/components/Table/TableWithSearch').TableWithSearch
