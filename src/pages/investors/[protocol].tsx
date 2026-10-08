import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import { lazy, Suspense } from 'react'
import { SEO } from '~/components/SEO'
import { Toast } from '~/components/Toast'
import {
	getInvestorsProject,
	getInvestorsSiteWithPathFallback,
	type InvestorsSiteId
} from '~/containers/Investors/config'
import { Logo } from '~/containers/Investors/Logo'
import { fetchCustomServerData } from '~/containers/Investors/serverDataRegistry'
import { useInvestorsSite } from '~/containers/Investors/SiteContext'

const InvestorsDashboard = lazy(() => import('~/containers/Investors'))

export const getServerSideProps: GetServerSideProps<{
	investorsSiteId: InvestorsSiteId
	protocol: string
	customServerData: Record<string, unknown>
}> = async (context) => {
	const protocol = context.params?.protocol
	if (typeof protocol !== 'string') {
		return { notFound: true }
	}

	const site = getInvestorsSiteWithPathFallback(
		context.req.headers.host,
		context.req.headers['x-forwarded-host'],
		protocol
	)
	if (!site) {
		return { notFound: true }
	}

	const project = getInvestorsProject(site, protocol)
	if (!project?.dashboardId) {
		return { notFound: true }
	}

	try {
		const customServerData = await fetchCustomServerData(project.dashboardId)
		return { props: { investorsSiteId: site.id, protocol, customServerData } }
	} catch {
		return { props: { investorsSiteId: site.id, protocol, customServerData: {} } }
	}
}

export default function InvestorsProtocolPage({
	protocol,
	customServerData
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	const site = useInvestorsSite()
	const project = site ? getInvestorsProject(site, protocol) : undefined
	if (!project) return null
	const protocolName = project?.name ?? protocol

	return (
		<>
			<SEO
				title={`DefiLlama x ${protocolName}`}
				description={`Verified metrics for ${protocolName} powered by DefiLlama`}
				canonicalUrl={null}
			/>
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
				<InvestorsDashboard protocol={protocol} customServerData={customServerData} />
			</Suspense>
			<Toast />
		</>
	)
}
