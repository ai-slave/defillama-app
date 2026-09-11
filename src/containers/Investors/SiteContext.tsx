import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { getInvestorsSite, INVESTORS_SITES, type InvestorsSite, type InvestorsSiteId } from './config'

// Undefined means a static/non-IR page has not resolved its host yet. Do not load analytics
// for the main site until hydration resolves it (including on an IR host's 404 page).
const InvestorsSiteContext = createContext<InvestorsSite | null | undefined>(undefined)
const subscribe = () => () => {}
const getServerSnapshot = () => undefined
const getClientSnapshot = () => getInvestorsSite(window.location.host)

export function InvestorsSiteProvider({ siteId, children }: { siteId?: InvestorsSiteId; children: ReactNode }) {
	// Host changes require a full navigation; there is no browser event to subscribe to.
	const clientSite = useSyncExternalStore<InvestorsSite | null | undefined>(
		subscribe,
		getClientSnapshot,
		getServerSnapshot
	)
	const site = siteId ? INVESTORS_SITES[siteId] : clientSite
	return <InvestorsSiteContext.Provider value={site}>{children}</InvestorsSiteContext.Provider>
}

export function useInvestorsSite() {
	return useContext(InvestorsSiteContext)
}
