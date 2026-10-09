import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { useGetLiteDashboards } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { useStorageItem } from '~/contexts/localStorageStore'
import defillamaPages from '~/public/pages.json'
import { Button } from '~/ui/Button'
import { takeLostFocus } from '~/ui/focus'
import { InlineStatus } from '~/ui/Status'
import { DesktopNav } from './Desktop'
import { MobileNav } from './Mobile'
import type { TNavLink, TNavLinks, TOldNavLink } from './types'

type DefillamaPage = {
	name: string
	route: string
	icon?: TNavLink['icon']
	isNew?: boolean
	umamiEvent?: string
	oldCategory?: string
	oldName?: string
	requireLlama?: boolean
}

type DefillamaPages = Record<string, Array<DefillamaPage>> & {
	Main?: Array<TNavLink>
	Premium?: Array<TNavLink>
	Metrics: Array<DefillamaPage>
	Tools: Array<DefillamaPage>
	Hidden?: Array<Pick<DefillamaPage, 'name' | 'route'>>
}

const pages = defillamaPages as DefillamaPages

const mainPages = pages.Main ?? []
const premiumPages = pages.Premium ?? []

const footerCategories = ['More', 'About Us'] as const
const footerLinks = footerCategories.map((category) => ({
	category,
	pages: (pages[category] ?? []) as Array<TNavLink>
})) as TNavLinks

// Skip "Hidden" so hidden page names (e.g. "Subscribe to DefiLlama") don't overwrite
// visible labels, and first-match-wins prevents later duplicates from replacing earlier ones.
const routeToPageMap = new Map<string, DefillamaPage>()
for (const [category, categoryPages] of Object.entries(pages)) {
	if (category === 'Hidden') continue
	for (const page of categoryPages) {
		if (!routeToPageMap.has(page.route)) {
			routeToPageMap.set(page.route, page)
		}
	}
}

const oldMetricLinksByName: Record<string, TOldNavLink> = {}
for (const curr of [...pages.Metrics, ...pages.Tools]) {
	if (curr.oldCategory && curr.oldName) {
		const groupedMetric = (oldMetricLinksByName[curr.oldCategory] ??= { name: curr.oldCategory, pages: [] })
		groupedMetric.pages ??= []
		groupedMetric.pages.push({ name: curr.oldName, route: curr.route })
	}
	if (curr.oldName && !curr.oldCategory) {
		oldMetricLinksByName[curr.oldName] ??= { name: curr.oldName, route: curr.route }
	}
}
const oldMetricLinks: Array<TOldNavLink> = Object.values(oldMetricLinksByName)

function normalizeAiRoute(route: string, shouldSkipLanding: boolean): string {
	return route === '/ai' && shouldSkipLanding ? '/ai/chat' : route
}

function canonicalAiRoute(route: string): string {
	return route === '/ai/chat' ? '/ai' : route
}

function parsePinnedMetrics(value: string): Array<string> {
	try {
		const parsed = JSON.parse(value)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

// The retry leaves once the list loads; focus moves to the first dashboard, else on to the next nav section. Outside a
// dialog nothing else catches it. Unlike passFocusOnLeave, this looks for the target after the commit, because the
// loaded links mount in the same commit that removes the retry.
function focusAfterDashboardsRetry(node: HTMLElement | null) {
	if (!node) return
	return () => {
		if (!node.contains(document.activeElement)) return
		const section = node.closest('[data-nav-dashboards]')
		const next = section?.nextElementSibling
		queueMicrotask(() =>
			takeLostFocus(
				(section?.isConnected ? section.querySelector<HTMLElement>('a[href]') : null) ??
					next?.querySelector<HTMLElement>('summary, a[href], button') ??
					null
			)
		)
	}
}

export function Nav({ tvlOptions }: { tvlOptions?: Array<{ name: string; key: string }> }) {
	const router = useRouter()
	// A rewritten 404 keeps the requested URL in the browser, unlike its static server render.
	const asPath = router.pathname === '/404' ? '/404' : router.asPath
	const {
		data: liteDashboards,
		failed: dashboardsFailed,
		isFetching: isFetchingDashboards,
		refetch: refetchDashboards
	} = useGetLiteDashboards()
	// A failed list says so where the list would be; the dashboards saved from the last load stay listed above it.
	const dashboardsStatus = dashboardsFailed ? (
		<InlineStatus
			variant="error"
			action={
				<Button
					ref={focusAfterDashboardsRetry}
					type="button"
					size="sm"
					onClick={() => void refetchDashboards()}
					pendingLabel="Retrying…"
					pending={isFetchingDashboards}
				>
					Try again
				</Button>
			}
		>
			{liteDashboards.length > 0 ? "Couldn't refresh your dashboards." : "Couldn't load your dashboards."}
		</InlineStatus>
	) : null

	const { isAuthenticated, user } = useAuthContext()
	const shouldSkipLanding = isAuthenticated
	const isLlamaUser = user?.flags?.is_llama === true

	const mainLinks = useMemo(() => {
		const main = mainPages.filter((p) => !p.requireLlama || isLlamaUser)
		const premium = premiumPages
			.filter((p) => !p.requireLlama || isLlamaUser)
			.map((p) => {
				const route = normalizeAiRoute(p.route, shouldSkipLanding)
				return route !== p.route ? { ...p, route } : p
			})
		return [
			{ category: 'Main', pages: main },
			{ category: 'Premium', pages: premium }
		]
	}, [shouldSkipLanding, isLlamaUser])

	const userDashboards = useMemo(
		() =>
			liteDashboards.map((dashboard) => ({
				name: dashboard.name,
				route: `/pro/${dashboard.slug || dashboard.id}`
			})),
		[liteDashboards]
	)
	const pinnedMetrics = useStorageItem('pinned-metrics', '[]')

	const pinnedPages = useMemo(() => {
		const parsed = pinnedMetrics ? parsePinnedMetrics(pinnedMetrics) : []
		if (parsed.length === 0) return []

		return parsed.flatMap((metric: string) => {
			const page = routeToPageMap.get(metric) ?? routeToPageMap.get(canonicalAiRoute(metric))
			if (!page) return []
			const route = normalizeAiRoute(page.route, shouldSkipLanding)
			return [route !== page.route ? { ...page, route } : page]
		})
	}, [pinnedMetrics, shouldSkipLanding])

	return (
		<>
			<DesktopNav
				mainLinks={mainLinks}
				pinnedPages={pinnedPages}
				userDashboards={userDashboards}
				dashboardsStatus={dashboardsStatus}
				footerLinks={footerLinks}
				oldMetricLinks={oldMetricLinks}
				asPath={asPath}
			/>
			<MobileNav
				mainLinks={mainLinks}
				pinnedPages={pinnedPages}
				userDashboards={userDashboards}
				dashboardsStatus={dashboardsStatus}
				footerLinks={footerLinks}
				tvlOptions={tvlOptions}
				oldMetricLinks={oldMetricLinks}
				asPath={asPath}
			/>
		</>
	)
}
