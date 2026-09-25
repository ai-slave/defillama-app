import { getMainSiteIrDashboard, isMainSiteIrVisible } from '~/containers/Investors/mainSiteDashboards'
import { slug } from '~/utils'

// A chain page shows the Enterprise tab only when the chain has a dashboard the viewer may see;
// `?tab=investor-relations` then swaps the overview for that dashboard.
export function getChainInvestorRelationsTab(chainName: string, tab: unknown, isLlama: boolean) {
	const dashboard = getMainSiteIrDashboard('chain', slug(chainName))
	if (!dashboard || !isMainSiteIrVisible(dashboard, isLlama)) return null
	return { dashboard, active: tab === 'investor-relations' }
}
