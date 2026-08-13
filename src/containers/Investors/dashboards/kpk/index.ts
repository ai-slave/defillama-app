import { lazy } from 'react'
import type { DashboardTabConfig } from '../../dashboardTypes'

const Overview = lazy(() => import('./Overview'))
const Mandates = lazy(() => import('./Mandates'))
const Vaults = lazy(() => import('./Vaults'))

export const tabs: DashboardTabConfig[] = [
	{ id: 'overview', label: 'Overview', component: Overview },
	{ id: 'mandates', label: 'Treasury mandates', component: Mandates },
	{ id: 'vaults', label: 'Vaults', component: Vaults },
	{ id: 'funds', label: 'Funds', comingSoon: true }
]

export const header = lazy(() => import('./KpkHeader'))
