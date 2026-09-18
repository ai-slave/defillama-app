import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import Router from 'next/router'
import '~/tailwind.css'
import Script from 'next/script'
import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { AuthProvider } from '~/auth'
import { DashboardSaveGuard } from '~/components/DashboardSaveGuard'
import { RouteProgressIndicator } from '~/components/RouteProgressIndicator'
import { UserSettingsSync } from '~/components/UserSettingsSync'
import { InvestorsSiteProvider, useInvestorsSite } from '~/containers/Investors/SiteContext'
import { useAuthBridge } from '~/hooks/useAuthBridge'
import { useParentAuthTracker } from '~/hooks/useParentAuthTracker'
import { useReferrer } from '~/hooks/useReferrer'
import { useUmamiIdentityTracker } from '~/hooks/useUmamiIdentityTracker'
import {
	AB_COOKIE_MAX_AGE_SECONDS,
	AB_EXPERIMENT_ID,
	AB_GROUP_ATTRIBUTE,
	AB_GROUP_COOKIE_NAME,
	AB_VISITOR_COOKIE_NAME,
	getABClientAssignment,
	getABGroupFromCookie
} from '~/utils/abTesting'
import { addABTag, trackUmamiEvent, UMAMI_READY_EVENT } from '~/utils/analytics/umami'

type NextPageWithLayout = AppProps['Component'] & {
	getLayout?: (page: ReactElement) => ReactElement
}

type AppPropsWithLayout = AppProps & {
	Component: NextPageWithLayout
}

const CHUNK_LOAD_ERROR_KEY = 'chunk-load-error-reload'
const AB_EXPOSURE_SESSION_KEY = `ab-exposure:${AB_EXPERIMENT_ID}`
const MAIN_UMAMI_WEBSITE_ID = 'ca346731-f7ec-437f-9727-162f29bb67ae'
const MAIN_UMAMI_DOMAINS = 'defillama.com'

function ensureClientABAssignment() {
	const hostname = window.location.hostname
	const isMainSite = hostname === 'defillama.com' || hostname === 'www.defillama.com'
	const isLocalDevelopment =
		process.env.NODE_ENV !== 'production' && (hostname === 'localhost' || hostname === '127.0.0.1')
	if (!isMainSite && !isLocalDevelopment) return

	try {
		const assignment = getABClientAssignment(document.cookie, () => crypto.randomUUID())
		if (assignment) {
			const attributes = `Max-Age=${AB_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${
				window.location.protocol === 'https:' ? '; Secure' : ''
			}`
			if (assignment.shouldSetVisitorCookie) {
				document.cookie = `${AB_VISITOR_COOKIE_NAME}=${assignment.visitorId}; ${attributes}`
			}
			document.cookie = `${AB_GROUP_COOKIE_NAME}=${assignment.group}; ${attributes}`
		}

		const group = getABGroupFromCookie(document.cookie)
		if (group) document.documentElement.setAttribute(AB_GROUP_ATTRIBUTE, group)
		else document.documentElement.removeAttribute(AB_GROUP_ATTRIBUTE)
	} catch {
		// A/B assignment must never prevent the app from loading.
	}
}

if (typeof window !== 'undefined') {
	ensureClientABAssignment()
	window.umamiABBeforeSend = (_type, payload) => addABTag(payload, document.cookie)
}

const isChunkLoadError = (error: unknown) => {
	if (!error) return false
	if (typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'ChunkLoadError') {
		return true
	}

	const message = String((error as { message?: string })?.message ?? error)
	return (
		message.includes('ChunkLoadError') || message.includes('Loading chunk') || message.includes('Failed to load chunk')
	)
}

function App({ Component, pageProps }: AppPropsWithLayout) {
	const reloadInProgressRef = useRef(false)
	const site = useInvestorsSite()
	const umamiWebsiteId = site === undefined ? null : (site?.umamiWebsiteId ?? MAIN_UMAMI_WEBSITE_ID)
	// Only send from the site's real hosts, so localhost and preview deployments stay out of tasty.
	const umamiDomains = site?.umamiDomains.join(',') ?? MAIN_UMAMI_DOMAINS

	useEffect(() => {
		const trackExposure = () => {
			if (!window.umami || sessionStorage.getItem(AB_EXPOSURE_SESSION_KEY)) return

			const group = getABGroupFromCookie(document.cookie)
			if (!group) return

			sessionStorage.setItem(AB_EXPOSURE_SESSION_KEY, group)
			trackUmamiEvent('ab-exposure', { experiment: AB_EXPERIMENT_ID, group })
		}

		trackExposure()
		window.addEventListener(UMAMI_READY_EVENT, trackExposure)
		return () => window.removeEventListener(UMAMI_READY_EVENT, trackExposure)
	}, [])

	useEffect(() => {
		const reloadOnce = (url?: string) => {
			if (typeof window === 'undefined') return
			if (reloadInProgressRef.current) return

			const targetUrl = url ?? window.location.href
			const lastReloadUrl = sessionStorage.getItem(CHUNK_LOAD_ERROR_KEY)
			if (lastReloadUrl === targetUrl) return

			reloadInProgressRef.current = true
			sessionStorage.setItem(CHUNK_LOAD_ERROR_KEY, targetUrl)
			if (url) {
				window.location.assign(url)
			} else {
				window.location.reload()
			}
		}

		const handleRouteChangeError = (error: unknown, url: string) => {
			if (!isChunkLoadError(error)) return
			reloadOnce(url)
		}

		const handleRouteChangeComplete = () => {
			reloadInProgressRef.current = false
			sessionStorage.removeItem(CHUNK_LOAD_ERROR_KEY)
		}

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			if (!isChunkLoadError(event.reason)) return
			reloadOnce()
		}

		const handleError = (event: ErrorEvent) => {
			if (!isChunkLoadError(event.error ?? event.message)) return
			reloadOnce()
		}

		Router.events.on('routeChangeComplete', handleRouteChangeComplete)
		Router.events.on('routeChangeError', handleRouteChangeError)
		window.addEventListener('unhandledrejection', handleUnhandledRejection)
		window.addEventListener('error', handleError)

		return () => {
			Router.events.off('routeChangeComplete', handleRouteChangeComplete)
			Router.events.off('routeChangeError', handleRouteChangeError)
			window.removeEventListener('unhandledrejection', handleUnhandledRejection)
			window.removeEventListener('error', handleError)
		}
	}, [])

	useAuthBridge()
	useParentAuthTracker()

	useUmamiIdentityTracker()
	useReferrer()
	const getLayout = Component.getLayout ?? ((page: ReactElement) => page)

	return (
		<>
			<Head>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
				/>
			</Head>
			{umamiWebsiteId ? (
				<Script
					src="/script2.js"
					strategy="lazyOnload"
					onReady={() => {
						window.dispatchEvent(new Event(UMAMI_READY_EVENT))
					}}
					data-website-id={umamiWebsiteId}
					data-host-url="https://tasty.defillama.com"
					data-domains={umamiDomains}
					data-before-send="umamiABBeforeSend"
				/>
			) : null}

			<RouteProgressIndicator />
			{getLayout(<Component {...pageProps} />)}
		</>
	)
}

function AppWrapper(props: AppPropsWithLayout) {
	const [queryClient] = useState(() => new QueryClient())

	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<UserSettingsSync />
				<DashboardSaveGuard />
				<InvestorsSiteProvider siteId={props.pageProps.investorsSiteId}>
					<App {...props} />
				</InvestorsSiteProvider>
			</AuthProvider>
			<ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
		</QueryClientProvider>
	)
}

export default AppWrapper
