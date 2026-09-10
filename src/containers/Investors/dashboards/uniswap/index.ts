import { lazy } from 'react'
import type { DashboardTabConfig } from '../../dashboardTypes'

const Overview = lazy(() => import('./Overview'))
const Security = lazy(() => import('./Security'))
const Liquidity = lazy(() => import('./Liquidity'))
const Integrations = lazy(() => import('./Integrations'))
const Assets = lazy(() => import('./Assets'))
const Economics = lazy(() => import('./Economics'))

// Tabs from the partner tracker, ordered per the partner's preference (Security last). Tabs without a component render the shared
// "Coming soon" panel until they are built.
export const tabs: Array<DashboardTabConfig> = [
	{ id: 'overview', label: 'Overview', component: Overview },
	{ id: 'liquidity', label: 'Liquidity Depth', component: Liquidity },
	{ id: 'integrations', label: 'Ecosystem & Integrations', component: Integrations },
	{ id: 'assets', label: 'Asset Breadth', component: Assets },
	{ id: 'economics', label: 'Economic Model', component: Economics },
	{ id: 'security', label: 'Security', component: Security }
]

export const header = lazy(() => import('./UniswapHeader'))
