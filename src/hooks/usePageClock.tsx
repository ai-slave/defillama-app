import { createContext, useContext, type ReactNode } from 'react'

/** Null on a page without a data function: nothing rendered a clock into its HTML. */
const PageClockContext = createContext<number | null>(null)

export function PageClockProvider({ pageClockSec, children }: { pageClockSec: number | null; children: ReactNode }) {
	return <PageClockContext.Provider value={pageClockSec}>{children}</PageClockContext.Provider>
}

/**
 * The unix second this page's HTML was rendered with, or null when the page has no data function. Render-time
 * decisions that must not change between the server and the hydrating client compare against it.
 */
export function usePageClockSec(): number | null {
	return useContext(PageClockContext)
}
