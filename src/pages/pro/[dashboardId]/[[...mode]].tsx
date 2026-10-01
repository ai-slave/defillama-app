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
import { ProButton } from '~/containers/ProDashboard/ui'
import type { DashboardSeo } from '~/containers/ProDashboard/utils/seo'
import { useIsClient } from '~/hooks/useIsClient'
import Layout from '~/layout'
import { Icon } from '~/ui/Icon'
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
	const isAccountLoading = loaders.userLoading
	const isLoading = (isEditing && !isClient) || isAccountLoading || isValidating || isLoadingDashboard
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
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Sign In Required</h1>
					<p className="text-center text-base text-pro-text-label">Please sign in to edit this dashboard</p>
					<ProButton
						as={BasicLink}
						href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
						variant="primary"
						size="lg"
						className="mt-7"
					>
						Sign In
					</ProButton>
				</div>
			)
		}

		if (loadError && loadError.status >= 500) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Failed to load dashboard</h1>
					<ProButton as={BasicLink} href={`/pro/${dashboardId}`} variant="primary" size="lg" className="mt-2">
						Back to dashboard
					</ProButton>
				</div>
			)
		}

		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
				<h1 className="text-3xl font-bold">Dashboard Not Found</h1>
				<ProButton as={BasicLink} href="/pro" variant="primary" size="lg" className="mt-7">
					Browse Dashboards
				</ProButton>
			</div>
		)
	}

	if (!isEditing) {
		if (dashboardId !== 'new' && !currentDashboard && initialStatus === 404) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Dashboard Not Found</h1>
					<p className="text-center text-base text-pro-text-label">This dashboard does not exist.</p>
					<ProButton as={BasicLink} href="/pro" variant="primary" size="lg" className="mt-7">
						Browse Dashboards
					</ProButton>
				</div>
			)
		}

		if (dashboardId !== 'new' && !currentDashboard && loadError?.status === 401) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Sign In Required</h1>
					<p className="text-center text-base text-pro-text-label">Please sign in to view this dashboard</p>
					<ProButton
						as={BasicLink}
						href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
						variant="primary"
						size="lg"
						className="mt-7"
					>
						Sign In
					</ProButton>
				</div>
			)
		}

		if (dashboardId !== 'new' && !currentDashboard && loadError && loadError.status >= 500) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Failed to load dashboard</h1>
					<p className="text-center text-base text-pro-text-label">
						Something went wrong while loading this dashboard. Please try again.
					</p>
					<ProButton type="button" onClick={reloadDashboard} variant="primary" size="lg" className="mt-2">
						Retry
					</ProButton>
				</div>
			)
		}

		if (dashboardId !== 'new' && !currentDashboard && isAuthenticated) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Dashboard Not Found</h1>
					<p className="text-center text-base text-pro-text-label">
						This dashboard does not exist or you don&apos;t have permission to view it
					</p>
					<ProButton as={BasicLink} href="/pro" variant="primary" size="lg" className="mt-7">
						Browse Dashboards
					</ProButton>
				</div>
			)
		}

		if (dashboardId === 'new' && !isAuthenticated) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Sign In Required</h1>
					<p className="text-center text-base text-pro-text-label">Please sign in to create a new dashboard</p>
					<ProButton
						as={BasicLink}
						href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
						variant="primary"
						size="lg"
						className="mt-7"
					>
						Sign In
					</ProButton>
				</div>
			)
		}

		if (!isAuthenticated && dashboardVisibility === 'private') {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Sign In Required</h1>
					<p className="text-center text-base text-pro-text-label">Please sign in to view this dashboard</p>
					<ProButton
						as={BasicLink}
						href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
						variant="primary"
						size="lg"
						className="mt-7"
					>
						Sign In
					</ProButton>
				</div>
			)
		}

		// Team viewers and admins without a seat may read private team dashboards; the server decided.
		const hasServerAccess = !!currentDashboard?.access && currentDashboard.access.role !== 'none'
		if (!hasActiveSubscription && dashboardVisibility !== 'public' && !hasServerAccess) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-8 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
					<h1 className="text-3xl font-bold">Pro Dashboard Access</h1>
					<p className="-mt-6 text-center text-base text-pro-text-label">
						Subscribe to Pro to access this dashboard and unlock advanced features
					</p>

					<div className="mx-auto flex flex-wrap items-center justify-center gap-4">
						<div className="flex items-center gap-2 text-sm">
							<Icon name="bar-chart-2" height={16} width={16} className="shrink-0 text-pro-accent" />
							<span>Customizable Charts</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<Icon name="activity" height={16} width={16} className="shrink-0 text-pro-accent" />
							<span>Multiple Dashboards</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<Icon name="percent" height={16} width={16} className="shrink-0 text-pro-accent" />
							<span>Advanced Analytics</span>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<Icon name="layers" height={16} width={16} className="shrink-0 text-pro-accent" />
							<span>Multi-Charts</span>
						</div>
					</div>

					<h2 className="text-3xl font-bold text-pro-text-primary">
						$49<span className="text-lg font-normal text-pro-text-secondary">/month</span>
					</h2>

					<ProButton
						as={BasicLink}
						href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
						variant="primary"
						size="lg"
					>
						Subscribe Now
					</ProButton>
				</div>
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

export const getServerSideProps = withServerSidePropsTelemetry('/pro/[dashboardId]/[[...mode]]', getDashboardPageProps)
