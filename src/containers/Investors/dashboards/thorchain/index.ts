import { lazy } from 'react'
import type { DashboardTabConfig } from '../../dashboardTypes'

const Overview = lazy(() => import('./Overview'))
const Financials = lazy(() => import('./Financials'))
const Volume = lazy(() => import('./Volume'))
const Network = lazy(() => import('./Network'))
const Token = lazy(() => import('./Token'))
const Unlocks = lazy(() => import('./Unlocks'))

// Liquidity lives on Overview; native fees/revenue/income come from DefiLlama adapters,
// unlocks from server-side emissions (see serverData.ts).
export const tabs: DashboardTabConfig[] = [
	{ id: 'overview', label: 'Overview', component: Overview },
	{ id: 'financials', label: 'Financials', component: Financials },
	{ id: 'volume', label: 'Volume', component: Volume },
	{ id: 'network', label: 'Network', component: Network },
	{ id: 'token', label: 'Tokens', component: Token },
	{ id: 'unlocks', label: 'Unlocks', component: Unlocks }
]

export const header = lazy(() => import('./ThorchainHeader'))
