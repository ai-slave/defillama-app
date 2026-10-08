import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

/**
 * A /rwa page is built ahead of time, so its HTML never knows the address query: a link with a view, a filter, a chart
 * type or a column set would paint the default first and jump once the router reads it. A head script marks the
 * document before the first paint when the address carries a query, the zones that read it (`RWA_QUERY_ZONE`) stay
 * hidden while the mark is on, and the mark goes when the router is ready (or after a few seconds, if it never is).
 */
export const RWA_QUERY_PENDING_CLASS = 'rwa-query-pending'
export const RWA_QUERY_ZONE = { 'data-rwa-query-zone': '' } as const

const PENDING_TIMEOUT_MS = 5000
const PENDING_SCRIPT = `if(location.search.length>1){var d=document.documentElement;d.classList.add('${RWA_QUERY_PENDING_CLASS}');setTimeout(function(){d.classList.remove('${RWA_QUERY_PENDING_CLASS}')},${PENDING_TIMEOUT_MS})}`
const PENDING_STYLE = `.${RWA_QUERY_PENDING_CLASS} [data-rwa-query-zone]{visibility:hidden}`

export function RWAQueryZoneGuard() {
	const { isReady } = useRouter()
	// The mark is set outside React, before hydration; only the router knows when the query has been read.
	useEffect(() => {
		if (isReady) document.documentElement.classList.remove(RWA_QUERY_PENDING_CLASS)
	}, [isReady])
	return (
		<Head>
			<style>{PENDING_STYLE}</style>
			{/* eslint-disable-next-line react/no-danger -- an inline head script has no React equivalent; the source is local */}
			<script dangerouslySetInnerHTML={{ __html: PENDING_SCRIPT }} />
		</Head>
	)
}
