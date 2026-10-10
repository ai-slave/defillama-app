import type { InferGetServerSidePropsType } from 'next'
import Head from 'next/head'
import Router, { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import ProDashboard from '~/containers/ProDashboard'
import { DashboardSeoSummary } from '~/containers/ProDashboard/components/DashboardSeoSummary'
import { ProDashboardLoader } from '~/containers/ProDashboard/components/ProDashboardLoader'
import { getEditorExitPath } from '~/containers/ProDashboard/editorAccess'
import { useDashboardEngagement } from '~/containers/ProDashboard/hooks/useDashboardEngagement'
import {
	type DashboardInitialRenderPayload,
	hydrateDashboardInitialRenderPayload,
	type PublicDashboardInitialRenderPayload
} from '~/containers/ProDashboard/initialDashboard'
import { ProDashboardAPIProvider, useProDashboardDashboard } from '~/containers/ProDashboard/ProDashboardAPIContext'
import { type DashboardPageMode, getDashboardPageProps } from '~/containers/ProDashboard/server/dashboardPageProps'
import type { DashboardSeo } from '~/containers/ProDashboard/utils/seo'
import { useIsClient } from '~/hooks/useIsClient'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { EmptyState, PanelStatus } from '~/ui/Status'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

const GENERIC_TITLE = 'DefiLlama Pro - Custom DeFi Dashboard'
const GENERIC_DESCRIPTION =
	'Custom DeFi analytics dashboard on DefiLlama Pro. No-code dashboards with TVL, fees, volume, and protocol metrics.'
const EDIT_TITLE = 'DefiLlama Pro - Edit Dashboard'
const EDIT_DESCRIPTION = 'Edit your custom DeFi analytics dashboard on DefiLlama Pro.'

function useRouteMode(initialMode: DashboardPageMode): DashboardPageMode {
	const router = useRouter()
	if (router.query.dashboardId === undefined) return initialMode
	const segments = router.query.mode
	const segment = Array.isArray(segments) ? segments[0] : segments
	return segment === 'edit' ? 'edit' : 'view'
}

export default function DashboardPage({
	dashboardId,
	mode: initialMode,
	initialDashboard,
	seo,
	ogImage,
	noIndex,
	status
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	const mode = useRouteMode(initialMode)
	const isEditing = mode === 'edit'
	const initialId = dashboardId === 'new' ? undefined : dashboardId
	const title = isEditing ? EDIT_TITLE : (seo?.title ?? GENERIC_TITLE)
	const description = isEditing ? EDIT_DESCRIPTION : (seo?.description ?? GENERIC_DESCRIPTION)
	const hideFromIndex = isEditing || noIndex
	const canonicalUrl = hideFromIndex ? null : (seo?.canonicalPath ?? `/pro/${dashboardId}`)
	const providerInitialDashboard = initialDashboard ? hydrateDashboardInitialRenderPayload(initialDashboard) : null

	return (
		<Layout
			title={title}
			description={description}
			canonicalUrl={canonicalUrl}
			noIndex={hideFromIndex}
			jsonLd={!hideFromIndex ? seo?.jsonLd : undefined}
			{...(ogImage && !isEditing ? { ogImage } : {})}
		>
			<div className="flex min-h-0 flex-1 flex-col gap-2">
				<ProDashboardAPIProvider
					initialDashboardId={initialId}
					initialDashboard={providerInitialDashboard}
					mode={initialId ? mode : 'edit'}
					key={`dashboard-provider-${dashboardId}`}
				>
					<DashboardPageContent
						dashboardId={dashboardId}
						mode={mode}
						initialStatus={status}
						initialDashboard={initialDashboard}
						seo={seo}
					/>
				</ProDashboardAPIProvider>
			</div>
		</Layout>
	)
}

function routeSuffix(asPath: string | undefined): string {
	const suffixStart = asPath?.search(/[?#]/) ?? -1
	return suffixStart === -1 ? '' : (asPath?.slice(suffixStart) ?? '')
}

function DashboardPageContent({
	dashboardId,
	mode,
	initialStatus,
	initialDashboard,
	seo
}: {
	dashboardId: string
	mode: DashboardPageMode
	initialStatus: number
	initialDashboard: DashboardInitialRenderPayload | null
	seo: DashboardSeo | null
}) {
	const router = useRouter()
	const isClient = useIsClient()
	const isEditing = mode === 'edit'

	const { isAuthenticated, loaders, hasActiveSubscription, user } = useAuthContext()
	const {
		isLoadingDashboard,
		streamHasResolved,
		loadError,
		reloadDashboard,
		dashboardVisibility,
		currentDashboard,
		dashboardName
	} = useProDashboardDashboard()
	const { trackView } = useDashboardEngagement(currentDashboard?.id ?? null)
	const hasTrackedView = useRef(false)
	const hasRedirectedRef = useRef(false)

	useEffect(() => {
		// The server auth snapshot is signed out until the browser restores its session.
		if (!isEditing || !isClient || loaders.userLoading || hasRedirectedRef.current) return
		const exitPath = getEditorExitPath({ dashboardId, isAuthenticated, userId: user?.id, dashboard: currentDashboard })
		if (exitPath) {
			hasRedirectedRef.current = true
			void Router.replace(exitPath, undefined, { shallow: true })
		}
	}, [isEditing, isClient, isAuthenticated, loaders.userLoading, currentDashboard, user?.id, dashboardId])

	// Read through locals: the pages router keeps one object identity and swaps `query` on navigation,
	// so these are the values that actually change.
	const routeDashboardId = router.query.dashboardId
	const routeAsPath = router.asPath
	useEffect(() => {
		if (dashboardId === 'new' || hasRedirectedRef.current || !currentDashboard?.slug) return
		if (
			typeof routeDashboardId === 'string' &&
			routeDashboardId !== 'new' &&
			routeDashboardId !== currentDashboard.slug
		) {
			void Router.replace(
				`/pro/${currentDashboard.slug}${isEditing ? '/edit' : ''}${routeSuffix(routeAsPath)}`,
				undefined,
				{ shallow: true }
			)
		}
	}, [dashboardId, isEditing, currentDashboard?.slug, routeDashboardId, routeAsPath])

	useEffect(() => {
		if (
			!isEditing &&
			dashboardId &&
			dashboardId !== 'new' &&
			dashboardVisibility === 'public' &&
			!isLoadingDashboard &&
			!hasTrackedView.current
		) {
			hasTrackedView.current = true
			trackView()
		}
	}, [isEditing, dashboardId, dashboardVisibility, isLoadingDashboard, trackView])

	// Without a server payload the page waits for the stream. A new dashboard waits for the client: the server's
	// auth snapshot is signed out and would offer "Sign In Required" to a signed-in visitor.
	const isValidating =
		!initialDashboard && (dashboardId === 'new' ? !isClient : !currentDashboard && !streamHasResolved)
	// The editor waits for the account to decide who may edit. A view waits only for its first load: an account change
	// keeps the shown dashboard and its open dialogs. A failed subscription read ends the wait in both.
	const isAccountLoading = loaders.sessionLoading && (isEditing || !currentDashboard)
	const isLoading = (isEditing && !isClient) || isAccountLoading || isValidating || isLoadingDashboard
	// The loader takes over while a reload runs, so this Try again never shows as pending.
	const dashboardRetry = { refetch: reloadDashboard, isFetching: isLoadingDashboard }
	const initialSeoSummary =
		!isEditing && initialDashboard && initialDashboard.visibility === 'public' && seo && !currentDashboard ? (
			<DashboardSeoSummary dashboard={initialDashboard as PublicDashboardInitialRenderPayload} seo={seo} />
		) : null

	if (isLoading) {
		if (isEditing) {
			return <ProDashboardLoader heading="Edit dashboard" />
		}
		return (
			<>
				{initialSeoSummary}
				<ProDashboardLoader
					heading={initialSeoSummary ? null : dashboardId === 'new' ? 'New dashboard' : 'Loading dashboard'}
				/>
			</>
		)
	}

	if (isEditing && !currentDashboard) {
		if (loadError?.status === 401) {
			return <SignInRequired hint="Sign in to edit this dashboard." />
		}

		if (loadError && loadError.status >= 500) {
			return (
				<PanelStatus variant="error" retry={dashboardRetry}>
					Couldn&apos;t load this dashboard.
				</PanelStatus>
			)
		}

		return <DashboardNotFound />
	}

	if (!isEditing) {
		if (dashboardId !== 'new' && !currentDashboard && initialStatus === 404) {
			return <DashboardNotFound hint="This dashboard does not exist." />
		}

		if (dashboardId !== 'new' && !currentDashboard && loadError?.status === 401) {
			return <SignInRequired hint="Sign in to view this dashboard." />
		}

		if (dashboardId !== 'new' && !currentDashboard && loadError && loadError.status >= 500) {
			return (
				<PanelStatus variant="error" retry={dashboardRetry}>
					Couldn&apos;t load this dashboard.
				</PanelStatus>
			)
		}

		if (dashboardId !== 'new' && !currentDashboard && isAuthenticated) {
			return <DashboardNotFound hint="This dashboard does not exist or you don't have permission to view it." />
		}

		if (dashboardId === 'new' && !isAuthenticated) {
			return <SignInRequired hint="Sign in to create a new dashboard." />
		}

		if (!isAuthenticated && dashboardVisibility === 'private') {
			return <SignInRequired hint="Sign in to view this dashboard." />
		}

		// Team viewers and admins without a seat may read private team dashboards; the server decided.
		const hasServerAccess = !!currentDashboard?.access && currentDashboard.access.role !== 'none'
		if (!hasActiveSubscription && dashboardVisibility !== 'public' && !hasServerAccess) {
			return (
				<EmptyState
					size="lg"
					headingAs="h1"
					title="Pro dashboard access"
					actions={
						<div className="flex flex-col items-center gap-6">
							<ul className="flex flex-wrap items-center justify-center gap-4">
								<li className="flex items-center gap-2 body-md">
									<Icon name="bar-chart-2" height={16} width={16} className="shrink-0 text-link" />
									<span>Customizable Charts</span>
								</li>
								<li className="flex items-center gap-2 body-md">
									<Icon name="activity" height={16} width={16} className="shrink-0 text-link" />
									<span>Multiple Dashboards</span>
								</li>
								<li className="flex items-center gap-2 body-md">
									<Icon name="percent" height={16} width={16} className="shrink-0 text-link" />
									<span>Advanced Analytics</span>
								</li>
								<li className="flex items-center gap-2 body-md">
									<Icon name="layers" height={16} width={16} className="shrink-0 text-link" />
									<span>Multi-Charts</span>
								</li>
							</ul>
							<p className="heading-lg text-primary">
								$49<span className="body-xl text-secondary">/month</span>
							</p>
							<Button
								as={BasicLink}
								href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
								variant="primary"
								size="md"
							>
								Subscribe now
							</Button>
						</div>
					}
				>
					Subscribe to Pro to access this dashboard and unlock advanced features.
				</EmptyState>
			)
		}
	}

	return (
		<>
			{isEditing ? (
				<Head>
					<title>{`Edit ${dashboardName} - DefiLlama`}</title>
				</Head>
			) : null}
			<ProDashboard />
		</>
	)
}

function SignInRequired({ hint }: { hint: string }) {
	const router = useRouter()
	return (
		<EmptyState
			size="lg"
			headingAs="h1"
			title="Sign in required"
			actions={
				<Button
					as={BasicLink}
					href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
					variant="primary"
					size="md"
				>
					Sign in
				</Button>
			}
		>
			{hint}
		</EmptyState>
	)
}

function DashboardNotFound({ hint }: { hint?: string }) {
	return (
		<EmptyState
			size="lg"
			headingAs="h1"
			title="Dashboard not found"
			actions={
				<Button as={BasicLink} href="/pro" size="md">
					Browse dashboards
				</Button>
			}
		>
			{hint}
		</EmptyState>
	)
}

export const getServerSideProps = withServerSidePropsTelemetry('/pro/[dashboardId]/[[...mode]]', getDashboardPageProps)
