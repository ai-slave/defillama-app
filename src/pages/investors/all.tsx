import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { lazy, Suspense } from 'react'
import { SEO } from '~/components/SEO'
import { Toast } from '~/components/Toast'
import {
	getInvestorsProjects,
	getInvestorsSiteWithPathFallback,
	type InvestorsSiteId
} from '~/containers/Investors/config'
import { Logo } from '~/containers/Investors/Logo'
import { fetchCustomServerData } from '~/containers/Investors/serverDataRegistry'
import { useInvestorsSite } from '~/containers/Investors/SiteContext'

const InvestorsDashboard = lazy(() => import('~/containers/Investors'))

export const getServerSideProps: GetServerSideProps<{
	investorsSiteId: InvestorsSiteId
	customServerData: Record<string, unknown>
}> = async (context) => {
	const site = getInvestorsSiteWithPathFallback(context.req.headers.host, context.req.headers['x-forwarded-host'])
	if (!site) {
		return { notFound: true }
	}

	if (site.projectIds.length === 1) {
		return {
			redirect: {
				destination: `/${site.defaultProjectId}`,
				permanent: false
			}
		}
	}

	const customServerData: Record<string, unknown> = {}
	try {
		const customResults = await Promise.all(
			getInvestorsProjects(site.projectIds).map((project) => fetchCustomServerData(project.dashboardId))
		)
		for (const data of customResults) Object.assign(customServerData, data)
	} catch {
		// Custom dashboard data is optional; the page renders without it.
	}

	return { props: { investorsSiteId: site.id, customServerData } }
}

export default function InvestorsAllPage({ customServerData }: InferGetServerSidePropsType<typeof getServerSideProps>) {
	const site = useInvestorsSite()
	if (!site) {
		return null
	}

	return (
		<>
			<SEO title="DefiLlama" description="Verified metrics powered by DefiLlama" canonicalUrl={null} />
			<link rel="preload" href="/assets/defillama.webp" as="image" />
			<link rel="preload" href="/assets/defillama-dark.webp" as="image" />
			<Suspense
				fallback={
					<div className="investors-dashboard col-span-full flex min-h-screen flex-col bg-page md:flex-row">
						<aside className="sl-sidebar fixed top-0 left-0 hidden h-screen w-56 md:block" />
						<div className="flex flex-1 items-center justify-center p-5 md:ml-56">
							<Logo animate />
						</div>
					</div>
				}
			>
				<InvestorsDashboard customServerData={customServerData} />
			</Suspense>
			<Toast />
		</>
	)
}
