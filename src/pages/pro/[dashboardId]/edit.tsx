import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { ProDashboardLoader } from '~/containers/ProDashboard/components/ProDashboardLoader'
import {
	hydrateDashboardInitialRenderPayload,
	toOwnerDashboardInitialRenderPayload,
	type DashboardInitialRenderPayload
} from '~/containers/ProDashboard/initialDashboard'
import { ProDashboardAPIProvider, useProDashboardDashboard } from '~/containers/ProDashboard/ProDashboardAPIContext'
import { fetchDashboardConfig } from '~/containers/ProDashboard/queries.server'
import { fetchAuthenticatedUserId, getAuthTokenFromRequest } from '~/containers/ProDashboard/server/auth'
import { useIsClient } from '~/hooks/useIsClient'
import Layout from '~/layout'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

const ProDashboard = lazy(() => import('~/containers/ProDashboard'))

type DashboardEditPageProps = {
	dashboardId: string
	initialDashboard: DashboardInitialRenderPayload | null
}

const getServerSidePropsHandler: GetServerSideProps<DashboardEditPageProps> = async (context) => {
	const dashboardId = context.params?.dashboardId as string

	context.res.setHeader('Cache-Control', 'private, no-store')

	const authToken = getAuthTokenFromRequest(context.req)
	if (!authToken) {
		context.res.statusCode = 401
		return { props: { dashboardId, initialDashboard: null } }
	}

	try {
		const [dashboard, authenticatedUserId] = await Promise.all([
			fetchDashboardConfig(dashboardId, authToken),
			fetchAuthenticatedUserId(authToken)
		])
		if (!dashboard) {
			return { notFound: true }
		}
		if (dashboard.slug && dashboard.slug !== dashboardId) {
			return {
				redirect: {
					destination: `/pro/${encodeURIComponent(dashboard.slug)}/edit`,
					permanent: true
				}
			}
		}
		return {
			props: {
				dashboardId,
				initialDashboard:
					authenticatedUserId === dashboard.user ? toOwnerDashboardInitialRenderPayload(dashboard) : null
			}
		}
	} catch {
		// Fall through; client will surface error
	}

	return { props: { dashboardId, initialDashboard: null } }
}

export default function DashboardEditPage({
	dashboardId,
	initialDashboard
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	const providerInitialDashboard = initialDashboard ? hydrateDashboardInitialRenderPayload(initialDashboard) : null
	return (
		<Layout
			title="DefiLlama Pro - Edit Dashboard"
			description="Edit your custom DeFi analytics dashboard on DefiLlama Pro."
			canonicalUrl={null}
			noIndex
		>
			<ProDashboardAPIProvider
				initialDashboardId={dashboardId}
				initialDashboard={providerInitialDashboard}
				mode="edit"
				key={`dashboard-edit-provider-${dashboardId}`}
			>
				<DashboardEditPageContent dashboardId={dashboardId} hasInitialDashboard={!!initialDashboard} />
			</ProDashboardAPIProvider>
		</Layout>
	)
}

function DashboardEditPageContent({
	dashboardId,
	hasInitialDashboard
}: {
	dashboardId: string
	hasInitialDashboard: boolean
}) {
	const router = useRouter()
	const isClient = useIsClient()
	const { isAuthenticated, loaders, user } = useAuthContext()
	const { isLoadingDashboard, streamHasResolved, loadError, currentDashboard, dashboardName } =
		useProDashboardDashboard()
	const [isValidating, setIsValidating] = useState(!hasInitialDashboard)
	const hasRedirectedRef = useRef(false)

	useEffect(() => {
		if (!isLoadingDashboard && (currentDashboard || streamHasResolved)) {
			queueMicrotask(() => setIsValidating(false))
		}
	}, [isLoadingDashboard, currentDashboard, streamHasResolved])

	useEffect(() => {
		// The server auth snapshot is signed out until the browser restores its session.
		if (!isClient || loaders.userLoading) return
		if (!isAuthenticated && !hasRedirectedRef.current) {
			hasRedirectedRef.current = true
			void router.replace(`/pro/${dashboardId}`)
			return
		}
		if (currentDashboard && user?.id && currentDashboard.user !== user.id && !hasRedirectedRef.current) {
			hasRedirectedRef.current = true
			void router.replace(`/pro/${currentDashboard.slug ?? dashboardId}`)
		}
	}, [isClient, isAuthenticated, loaders.userLoading, currentDashboard, user?.id, dashboardId, router])

	// Read through locals: the pages router keeps one object identity and swaps `query` on navigation,
	// so these are the values that actually change.
	const routeDashboardId = router.query.dashboardId
	useEffect(() => {
		if (hasRedirectedRef.current || !currentDashboard?.slug) return
		if (typeof routeDashboardId === 'string' && routeDashboardId !== currentDashboard.slug) {
			void router.replace(`/pro/${currentDashboard.slug}/edit`, undefined, { shallow: true })
		}
	}, [currentDashboard?.slug, routeDashboardId, router])

	const isLoading = !isClient || loaders.userLoading || isValidating || isLoadingDashboard

	if (isLoading) {
		return <ProDashboardLoader heading="Edit dashboard" />
	}

	if (!currentDashboard && loadError?.status === 401) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
				<h1 className="text-3xl font-bold">Sign In Required</h1>
				<p className="text-center text-base text-pro-text-label">Please sign in to edit this dashboard</p>
				<BasicLink
					href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
					className="mt-7 rounded-md pro-btn-ai px-6 py-3 font-medium"
				>
					Sign In
				</BasicLink>
			</div>
		)
	}

	if (!currentDashboard && loadError && loadError.status >= 500) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
				<h1 className="text-3xl font-bold">Failed to load dashboard</h1>
				<BasicLink href={`/pro/${dashboardId}`} className="mt-2 rounded-md pro-btn-ai px-6 py-3 font-medium">
					Back to dashboard
				</BasicLink>
			</div>
		)
	}

	if (!currentDashboard) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1">
				<h1 className="text-3xl font-bold">Dashboard Not Found</h1>
				<BasicLink href="/pro" className="mt-7 rounded-md pro-btn-ai px-6 py-3 font-medium">
					Browse Dashboards
				</BasicLink>
			</div>
		)
	}

	return (
		<>
			<Head>
				<title>{`Edit ${dashboardName} - DefiLlama`}</title>
			</Head>
			<Suspense
				fallback={
					<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1" />
				}
			>
				<ProDashboard />
			</Suspense>
		</>
	)
}

export const getServerSideProps = withServerSidePropsTelemetry('/pro/[dashboardId]/edit', getServerSidePropsHandler)
