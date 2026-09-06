import { lazy } from 'react'
import type { DashboardTabConfig } from '../../dashboardTypes'

const Overview = lazy(() => import('./Overview'))
const FAssets = lazy(() => import('./FAssets'))
const Tokenomics = lazy(() => import('./Tokenomics'))
const Staking = lazy(() => import('./Staking'))
const Network = lazy(() => import('./Network'))

export const tabs: Array<DashboardTabConfig> = [
	{ id: 'overview', label: 'Overview', component: Overview },
	{ id: 'fassets', label: 'FAssets', component: FAssets },
	{ id: 'tokenomics', label: 'Tokenomics', component: Tokenomics },
	{ id: 'staking', label: 'Staking', component: Staking },
	{ id: 'network', label: 'Network', component: Network }
]

export const header = lazy(() => import('./FlareHeader'))
