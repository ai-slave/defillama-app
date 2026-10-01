import { createContext, useContext, type ReactNode } from 'react'

/** Null on a page without a data function: nothing rendered a clock into its HTML. */
export const PageClockContext = createContext<number | null>(null)

export function PageClockProvider({ pageClockSec, children }: { pageClockSec: number | null; children: ReactNode }) {
	return <PageClockContext.Provider value={pageClockSec}>{children}</PageClockContext.Provider>
}

/**
 * The unix second this page's props were built: the clock for values that describe the page data's own period, such
 * as its last completed day or a window ending at the data. The server HTML and every client render agree on it, and
 * a client navigation brings the next page's clock with its data. Values about now (a countdown, an age, a staleness
 * warning) use `useNowSeconds` instead.
 */
export function usePageClockSec(): number {
	const pageClockSec = useContext(PageClockContext)
	// Page data only comes from a data function, and every data function stamps a clock.
	if (pageClockSec === null) throw new Error('usePageClockSec needs a page whose data function stamps a clock.')
	return pageClockSec
}
