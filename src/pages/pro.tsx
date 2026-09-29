import * as Ariakit from '@ariakit/react'
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { AuthorProfileStrip } from '~/containers/ProDashboard/components/AuthorProfileStrip'
import type { ComparisonPreset } from '~/containers/ProDashboard/components/ComparisonWizard/types'
import { DashboardDiscovery } from '~/containers/ProDashboard/components/DashboardDiscovery'
import { DashboardList } from '~/containers/ProDashboard/components/DashboardList'
import { DashboardPaywallModal, type PaywallReason } from '~/containers/ProDashboard/components/DashboardPaywallModal'
import { buildDashboardPreview } from '~/containers/ProDashboard/components/dashboardPreview.utils'
import { FollowingShelves } from '~/containers/ProDashboard/components/FollowingShelves'
import { LikedDashboards } from '~/containers/ProDashboard/components/LikedDashboards'
import { MyDashboardsControls } from '~/containers/ProDashboard/components/MyDashboardsControls'
import {
	areMyDashboardsControlsActive,
	DEFAULT_MY_DASHBOARDS_CONTROLS,
	filterAndSortMyDashboards,
	getMyDashboardsRequest,
	MY_DASHBOARDS_FILTERED_PAGE_SIZE
} from '~/containers/ProDashboard/components/myDashboardsControls.utils'
import { MyProfileTab } from '~/containers/ProDashboard/components/MyProfileTab'
import { ProCardError } from '~/containers/ProDashboard/components/ProCardStatus'
import { ProDashboardLoader } from '~/containers/ProDashboard/components/ProDashboardLoader'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import {
	DISCOVERY_CATEGORIES,
	type DiscoveryCategoriesInitialData,
	type DiscoveryCategoryResponse
} from '~/containers/ProDashboard/discoveryCategories'
import { useFreeTierStatus } from '~/containers/ProDashboard/hooks/useFreeTierStatus'
import { useMyDashboards } from '~/containers/ProDashboard/hooks/useMyDashboards'
import { useMyTeam } from '~/containers/ProDashboard/hooks/useMyTeam'
import { useTeamDashboards } from '~/containers/ProDashboard/hooks/useTeamDashboards'
import {
	ProDashboardAPIProvider,
	useProDashboardDashboard,
	useProDashboardUI
} from '~/containers/ProDashboard/ProDashboardAPIContext'
import { getAuthTokenFromRequest } from '~/containers/ProDashboard/server/auth'
import { dashboardAPI } from '~/containers/ProDashboard/services/DashboardAPI'
import { ProButton, ProDialogFallback, ProMeta, proPanelStyles, proTabStyles } from '~/containers/ProDashboard/ui'
import Layout from '~/layout'
import { Icon } from '~/ui/Icon'
import { Tab, TabPanel, Tabs } from '~/ui/Tabs'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'
const CreateDashboardPicker = lazy(() =>
	import('~/containers/ProDashboard/components/CreateDashboardPicker').then((m) => ({
		default: m.CreateDashboardPicker
	}))
)
const GenerateDashboardModal = lazy(() =>
	import('~/containers/ProDashboard/components/GenerateDashboardModal').then((m) => ({
		default: m.GenerateDashboardModal
	}))
)

const PUBLIC_PRO_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600'
const PRIVATE_PRO_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate'
const DISCOVERY_FETCH_TIMEOUT_MS = 3000

type ProPageProps = {
	initialDiscoveryCategories: DiscoveryCategoriesInitialData
}

function compactDiscoveryAuthor(author: Dashboard['author']): Dashboard['author'] {
	if (
		!author?.slug ||
		!author.displayName ||
		typeof author.createdAt !== 'string' ||
		typeof author.updatedAt !== 'string'
	) {
		return undefined
	}
	return {
		slug: author.slug,
		displayName: author.displayName,
		bio: author.bio ?? null,
		avatarUrl: author.avatarUrl ?? null,
		socials: author.socials || {},
		createdAt: author.createdAt,
		updatedAt: author.updatedAt
	}
}

function compactDiscoveryDashboard(dashboard: Dashboard): Dashboard {
	const author = compactDiscoveryAuthor(dashboard.author)
	return {
		...(dashboard.copiedFrom ? { copiedFrom: dashboard.copiedFrom } : {}),
		id: dashboard.id,
		preview: buildDashboardPreview(dashboard.data?.items ?? []),
		slug: dashboard.slug,
		visibility: dashboard.visibility,
		tags: Array.isArray(dashboard.tags) ? dashboard.tags.filter((tag) => typeof tag === 'string' && tag.trim()) : [],
		description: typeof dashboard.description === 'string' ? dashboard.description : '',
		viewCount: dashboard.viewCount,
		likeCount: dashboard.likeCount,
		liked: dashboard.liked,
		...(author ? { author } : {}),
		created: dashboard.created,
		updated: dashboard.updated,
		editedAt: dashboard.editedAt,
		data: {
			dashboardName: dashboard.data?.dashboardName || 'Untitled Dashboard',
			items: (dashboard.data?.items ?? []).map((item: any, index) => ({
				id: typeof item?.id === 'string' ? item.id : `item-${index}`,
				kind: typeof item?.kind === 'string' ? item.kind : 'text'
			})) as Dashboard['data']['items']
		}
	} as Dashboard
}

function compactDiscoveryResponse(response: DiscoveryCategoryResponse): DiscoveryCategoryResponse {
	return {
		...response,
		items: response.items.map(compactDiscoveryDashboard)
	}
}

async function fetchDiscoveryCategory(
	category: (typeof DISCOVERY_CATEGORIES)[number]
): Promise<DiscoveryCategoryResponse> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), DISCOVERY_FETCH_TIMEOUT_MS)

	try {
		const response = await dashboardAPI.searchDashboards(
			{
				visibility: 'public',
				sortBy: category.sortBy,
				timeFrame: category.timeFrame,
				page: 1,
				limit: category.limit
			},
			(url, options) => fetch(url, { ...options, signal: controller.signal })
		)
		return compactDiscoveryResponse(response)
	} finally {
		clearTimeout(timeout)
	}
}

async function fetchInitialDiscoveryCategories(): Promise<DiscoveryCategoriesInitialData> {
	const results = await Promise.allSettled(
		DISCOVERY_CATEGORIES.map(async (category) => ({
			key: category.key,
			data: await fetchDiscoveryCategory(category)
		}))
	)
	const categories: DiscoveryCategoriesInitialData = {}

	for (const result of results) {
		if (result.status === 'fulfilled') {
			categories[result.value.key] = result.value.data
		}
	}

	return categories
}

const getServerSidePropsHandler: GetServerSideProps<ProPageProps> = async ({ req, res }) => {
	const authToken = getAuthTokenFromRequest(req)
	res.setHeader('Cache-Control', authToken ? PRIVATE_PRO_CACHE_CONTROL : PUBLIC_PRO_CACHE_CONTROL)
	res.setHeader('Vary', 'Cookie, Authorization')

	return {
		props: {
			initialDiscoveryCategories: await fetchInitialDiscoveryCategories()
		}
	}
}

function ProPageContent({ initialDiscoveryCategories }: ProPageProps) {
	const { isAuthenticated, loaders, hasActiveSubscription } = useAuthContext()

	if (loaders.userLoading) {
		return (
			<Layout
				title="DefiLlama Pro - Advanced DeFi Analytics Dashboard"
				description="Build custom no-code DeFi dashboards with DefiLlama Pro. Combine TVL, fees, volume, and protocol metrics into personalized analytics views."
				canonicalUrl="/pro"
			>
				<ProDashboardLoader heading="Custom Dashboards" />
			</Layout>
		)
	}

	return (
		<Layout
			title="DefiLlama Pro - Advanced DeFi Analytics Dashboard"
			description="Build custom no-code DeFi dashboards with DefiLlama Pro. Combine TVL, fees, volume, and protocol metrics into personalized analytics views."
			canonicalUrl="/pro"
		>
			<ProContent
				hasActiveSubscription={hasActiveSubscription}
				isAuthenticated={isAuthenticated}
				initialDiscoveryCategories={initialDiscoveryCategories}
			/>
		</Layout>
	)
}

const tabs = ['my-dashboards', 'team', 'discover', 'favorites', 'following', 'profile'] as const
const publicTabs = ['discover'] as const
type ProTab = (typeof tabs)[number]

function getDashboardPagesToShow(selectedPage: number, totalPages: number): Array<number> {
	if (totalPages < 1) return []
	const clampedSelectedPage = Math.max(1, Math.min(selectedPage, totalPages))
	const pagesToShow =
		clampedSelectedPage === 1
			? [1, 2, Math.min(3, totalPages)]
			: clampedSelectedPage === totalPages
				? [Math.max(1, totalPages - 2), Math.max(1, totalPages - 1), totalPages]
				: [clampedSelectedPage - 1, clampedSelectedPage, clampedSelectedPage + 1]

	return pagesToShow.filter((n, i, arr) => n >= 1 && n <= totalPages && arr.indexOf(n) === i)
}

function ProContent({
	hasActiveSubscription,
	isAuthenticated,
	initialDiscoveryCategories
}: {
	hasActiveSubscription: boolean
	isAuthenticated: boolean
	initialDiscoveryCategories: DiscoveryCategoriesInitialData
}) {
	const router = useRouter()
	const { tab } = router.query
	const myTeam = useMyTeam()
	const availableTabs = isAuthenticated ? (myTeam ? tabs : tabs.filter((value) => value !== 'team')) : publicTabs
	const activeTab = availableTabs.find((value) => value === tab) ?? 'discover'

	const switchTab = (nextTab: ProTab) => {
		if (nextTab === activeTab) return
		void router.replace({ pathname: '/pro', query: { tab: nextTab } }, undefined, { shallow: true, scroll: false })
	}

	const [paywallState, setPaywallState] = useState<{ open: boolean; reason: PaywallReason }>({
		open: false,
		reason: 'pro-feature'
	})
	const paywallDialogStore = Ariakit.useDialogStore({
		open: paywallState.open,
		setOpen: (open) => setPaywallState((prev) => ({ ...prev, open }))
	})
	const showPaywall = (reason: PaywallReason) => {
		setSignupSource('pro-dashboard')
		setPaywallState({ open: true, reason })
	}
	const { deleteDashboard, handleCreateDashboard, handleGenerateDashboard } = useProDashboardDashboard()
	const { createDashboardDialogStore, showGenerateDashboardModal, setShowGenerateDashboardModal } = useProDashboardUI()
	const { canCreateDashboard } = useFreeTierStatus()
	const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset | null>(null)
	const createDialogOpen = Ariakit.useStoreState(createDashboardDialogStore, 'open')
	const dialogWasOpenRef = useRef(false)

	const selectedPage =
		typeof router.query.page === 'string' && !Number.isNaN(Number(router.query.page))
			? parseInt(router.query.page, 10)
			: 1
	const [myDashboardsControls, setMyDashboardsControls] = useState(DEFAULT_MY_DASHBOARDS_CONTROLS)
	const myDashboardsControlsActive = areMyDashboardsControlsActive(myDashboardsControls)
	const {
		dashboards: myDashboards,
		isLoading: isLoadingMyDashboards,
		totalPages: myDashboardsTotalPages,
		totalItems: myDashboardsTotalItems,
		error: myDashboardsError,
		refetch: refetchMyDashboards,
		goToPage
	} = useMyDashboards({
		...getMyDashboardsRequest(myDashboardsControls, selectedPage),
		enabled: isAuthenticated
	})
	const visibleMyDashboards = myDashboardsControlsActive
		? filterAndSortMyDashboards(myDashboards, myDashboardsControls)
		: myDashboards
	const {
		dashboards: teamDashboards,
		isLoading: isLoadingTeamDashboards,
		totalPages: teamDashboardsTotalPages,
		totalItems: teamDashboardsTotalItems,
		error: teamDashboardsError,
		refetch: refetchTeamDashboards,
		goToPage: goToTeamPage
	} = useTeamDashboards({
		page: activeTab === 'team' ? selectedPage : 1,
		limit: 20,
		enabled: isAuthenticated && !!myTeam
	})
	// A failed list load is not an empty list: without this the page offers "Create your first dashboard".
	const myDashboardsFailed = !!myDashboardsError && myDashboards.length === 0
	const teamDashboardsFailed = !!teamDashboardsError && teamDashboards.length === 0

	useEffect(() => {
		if (createDialogOpen && !dialogWasOpenRef.current) {
			dialogWasOpenRef.current = true
			return
		}
		if (!createDialogOpen && dialogWasOpenRef.current) {
			let cancelled = false
			queueMicrotask(() => {
				if (cancelled) return
				setComparisonPreset(null)
			})
			dialogWasOpenRef.current = false

			return () => {
				cancelled = true
			}
		}
	}, [createDialogOpen])

	// Read through locals: the pages router keeps one object identity and swaps `query` on navigation,
	// so these are the values that actually change.
	const routerIsReady = router.isReady
	const routerQuery = router.query
	useEffect(() => {
		if (!routerIsReady) return
		const comparison = routerQuery.comparison
		const items = routerQuery.items
		if (comparison !== 'protocols' || typeof items !== 'string') return
		if (comparisonPreset) return
		const parsedItems = items.split(',').flatMap((item) => {
			const trimmed = item.trim()
			return trimmed ? [trimmed] : []
		})
		const { comparison: _comparison, items: _items, step: _step, ...rest } = routerQuery
		let cancelled = false
		if (parsedItems.length > 0) {
			queueMicrotask(() => {
				if (cancelled) return
				setComparisonPreset({ comparisonType: 'protocols', items: parsedItems })
			})
		}
		createDashboardDialogStore.show()
		void router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })

		return () => {
			cancelled = true
		}
	}, [comparisonPreset, createDashboardDialogStore, router, routerIsReady, routerQuery])

	return (
		<Tabs value={activeTab} onValueChange={switchTab} values={availableTabs}>
			<div className="flex flex-1 flex-col gap-4 p-2 pro-dashboard lg:px-0">
				<div className="flex items-center gap-2">
					<Ariakit.TabList className="flex scrollbar-none min-w-0 overflow-x-auto" aria-label="Dashboard views">
						<Tab type="button" value="discover" data-umami-event="dashboard-open-discover" className={proTabStyles}>
							Discover
						</Tab>
						{isAuthenticated ? (
							<Tab
								type="button"
								value="my-dashboards"
								data-umami-event="dashboard-open-my-dashboards"
								className={proTabStyles}
							>
								My Dashboards
							</Tab>
						) : null}
						{isAuthenticated && myTeam ? (
							<Tab type="button" value="team" data-umami-event="dashboard-open-team" className={proTabStyles}>
								Team
							</Tab>
						) : null}
						{isAuthenticated ? (
							<Tab type="button" value="favorites" data-umami-event="dashboard-open-favorites" className={proTabStyles}>
								Favorites
							</Tab>
						) : null}
						{isAuthenticated ? (
							<Tab type="button" value="following" data-umami-event="dashboard-open-following" className={proTabStyles}>
								Following
							</Tab>
						) : null}
						{isAuthenticated ? (
							<Tab type="button" value="profile" data-umami-event="dashboard-open-my-profile" className={proTabStyles}>
								My Profile
							</Tab>
						) : null}
					</Ariakit.TabList>
					<div className="ml-auto flex shrink-0 items-center gap-2">
						<ProButton
							type="button"
							variant="ai"
							onClick={
								!isAuthenticated
									? () => router.push('/pro/preview')
									: hasActiveSubscription
										? () => setShowGenerateDashboardModal(true)
										: () => showPaywall('llamaai')
							}
							data-umami-event="dashboard-llamaai-generate"
						>
							<Icon name="sparkles" height={14} width={14} />
							<span className="sm:hidden">Generate</span>
							<span className="hidden sm:inline">Generate with LlamaAI</span>
						</ProButton>

						<ProButton
							type="button"
							variant="primary"
							onClick={
								!isAuthenticated
									? () => router.push('/pro/preview')
									: canCreateDashboard
										? () => createDashboardDialogStore.show()
										: () => showPaywall('dashboard-limit')
							}
							data-umami-event="dashboard-create"
						>
							<Icon name="plus" height={14} width={14} />
							<span className="sm:hidden">Create</span>
							<span className="hidden sm:inline">Create dashboard</span>
						</ProButton>
					</div>
				</div>

				<TabPanel value="discover" className="flex flex-col gap-4">
					<DashboardDiscovery initialCategories={initialDiscoveryCategories} />
				</TabPanel>

				{isAuthenticated ? (
					<TabPanel value="my-dashboards" className="flex flex-col gap-4">
						<AuthorProfileStrip />

						<MyDashboardsControls
							query={myDashboardsControls.query}
							sort={myDashboardsControls.sort}
							visibility={myDashboardsControls.visibility}
							onQueryChange={(query) => setMyDashboardsControls((previous) => ({ ...previous, query }))}
							onSortChange={(sort) => setMyDashboardsControls((previous) => ({ ...previous, sort }))}
							onVisibilityChange={(visibility) => setMyDashboardsControls((previous) => ({ ...previous, visibility }))}
						/>

						{!isLoadingMyDashboards && !myDashboardsFailed ? (
							<ProMeta
								items={[
									myDashboardsControlsActive
										? `${visibleMyDashboards.length} matching ${visibleMyDashboards.length === 1 ? 'dashboard' : 'dashboards'}`
										: `Showing ${myDashboards.length} of ${myDashboardsTotalItems} dashboards`,
									myDashboardsControlsActive && myDashboardsTotalItems > MY_DASHBOARDS_FILTERED_PAGE_SIZE
										? `Searching the ${MY_DASHBOARDS_FILTERED_PAGE_SIZE} most recent dashboards`
										: null
								]}
							/>
						) : null}

						{myDashboardsFailed ? (
							<div className={`${proPanelStyles} flex flex-col py-12`}>
								<ProCardError title="Couldn't load your dashboards." onRetry={() => void refetchMyDashboards()} />
							</div>
						) : (
							<DashboardList
								dashboards={visibleMyDashboards}
								isLoading={isLoadingMyDashboards}
								onCreateNew={() => createDashboardDialogStore.show()}
								onDeleteDashboard={deleteDashboard}
								{...(myDashboardsControlsActive && myDashboardsTotalItems > 0
									? {
											emptyMessage: {
												title: myDashboardsControls.query.trim()
													? `No dashboards match “${myDashboardsControls.query.trim()}”`
													: 'No dashboards match these filters',
												onClearFilters: () => setMyDashboardsControls(DEFAULT_MY_DASHBOARDS_CONTROLS)
											}
										}
									: {})}
							/>
						)}

						{!myDashboardsControlsActive && myDashboardsTotalPages > 1 ? (
							<div className="flex flex-nowrap items-center justify-center gap-1 overflow-x-auto">
								<ProButton
									type="button"
									square
									variant="ghost"
									aria-label="First page"
									onClick={() => goToPage(1)}
									disabled={selectedPage < 3}
									className="disabled:hidden"
								>
									<Icon name="chevrons-left" height={16} width={16} />
								</ProButton>

								<ProButton
									type="button"
									square
									variant="ghost"
									aria-label="Previous page"
									onClick={() => goToPage(Math.max(1, selectedPage - 1))}
									disabled={selectedPage === 1}
									className="disabled:hidden"
								>
									<Icon name="chevron-left" height={16} width={16} />
								</ProButton>

								{getDashboardPagesToShow(selectedPage, myDashboardsTotalPages).map((pageNum) => {
									const isActive = selectedPage === pageNum
									return (
										<ProButton
											type="button"
											square
											variant={isActive ? 'primary' : 'ghost'}
											key={`my-dashboard-page-${pageNum}`}
											onClick={() => goToPage(pageNum)}
											{...(isActive ? { 'aria-current': 'page' as const } : {})}
										>
											{pageNum}
										</ProButton>
									)
								})}

								<ProButton
									type="button"
									square
									variant="ghost"
									aria-label="Next page"
									onClick={() => goToPage(Math.min(myDashboardsTotalPages, selectedPage + 1))}
									disabled={selectedPage === myDashboardsTotalPages}
									className="disabled:hidden"
								>
									<Icon name="chevron-right" height={16} width={16} />
								</ProButton>
								<ProButton
									type="button"
									square
									variant="ghost"
									aria-label="Last page"
									onClick={() => goToPage(myDashboardsTotalPages)}
									disabled={selectedPage > myDashboardsTotalPages - 2}
									className="disabled:hidden"
								>
									<Icon name="chevrons-right" height={16} width={16} />
								</ProButton>
							</div>
						) : null}
					</TabPanel>
				) : null}

				{isAuthenticated && myTeam ? (
					<TabPanel value="team" className="flex flex-col gap-4">
						{!isLoadingTeamDashboards && !teamDashboardsFailed ? (
							<ProMeta
								items={[
									`Shared with ${myTeam.name}`,
									`Showing ${teamDashboards.length} of ${teamDashboardsTotalItems} dashboards`
								]}
							/>
						) : null}

						{teamDashboardsFailed ? (
							<div className={`${proPanelStyles} flex flex-col py-12`}>
								<ProCardError title="Couldn't load team dashboards" onRetry={() => void refetchTeamDashboards()} />
							</div>
						) : (
							<DashboardList
								dashboards={teamDashboards}
								isLoading={isLoadingTeamDashboards}
								onCreateNew={() => createDashboardDialogStore.show()}
								onDeleteDashboard={deleteDashboard}
							/>
						)}

						{teamDashboardsTotalPages > 1 ? (
							<div className="flex flex-nowrap items-center justify-center gap-1 overflow-x-auto">
								{getDashboardPagesToShow(selectedPage, teamDashboardsTotalPages).map((pageNum) => {
									const isActive = selectedPage === pageNum
									return (
										<ProButton
											type="button"
											square
											variant={isActive ? 'primary' : 'ghost'}
											key={`team-dashboard-page-${pageNum}`}
											onClick={() => goToTeamPage(pageNum)}
											{...(isActive ? { 'aria-current': 'page' as const } : {})}
										>
											{pageNum}
										</ProButton>
									)
								})}
							</div>
						) : null}
					</TabPanel>
				) : null}

				{isAuthenticated ? (
					<TabPanel value="favorites" className="flex flex-col gap-4">
						<LikedDashboards />
					</TabPanel>
				) : null}

				{isAuthenticated ? (
					<TabPanel value="following" className="flex flex-col gap-4">
						<FollowingShelves />
					</TabPanel>
				) : null}

				{isAuthenticated && activeTab === 'profile' ? (
					<TabPanel value="profile" className="flex flex-col gap-6">
						<MyProfileTab />
					</TabPanel>
				) : null}

				<Suspense fallback={createDialogOpen ? <ProDialogFallback width="lg" /> : null}>
					<CreateDashboardPicker
						dialogStore={createDashboardDialogStore}
						onCreate={handleCreateDashboard}
						comparisonPreset={comparisonPreset}
						team={myTeam}
					/>
				</Suspense>

				<Suspense fallback={showGenerateDashboardModal ? <ProDialogFallback width="md" /> : null}>
					<GenerateDashboardModal
						isOpen={showGenerateDashboardModal}
						onClose={() => setShowGenerateDashboardModal(false)}
						onGenerate={handleGenerateDashboard}
					/>
				</Suspense>

				{paywallState.open ? (
					<DashboardPaywallModal dialogStore={paywallDialogStore} reason={paywallState.reason} />
				) : null}
			</div>
		</Tabs>
	)
}

export default function HomePage({
	initialDiscoveryCategories
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	return (
		<AppMetadataProvider>
			<ProDashboardAPIProvider>
				<ProPageContent initialDiscoveryCategories={initialDiscoveryCategories} />
			</ProDashboardAPIProvider>
		</AppMetadataProvider>
	)
}

export const getServerSideProps = withServerSidePropsTelemetry('/pro', getServerSidePropsHandler)
