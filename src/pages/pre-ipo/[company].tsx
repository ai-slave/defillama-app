import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { PreIpoCompanyPage } from '~/containers/PreIPO/CompanyPage'
import { getPreIpoCompanyPageData } from '~/containers/PreIPO/queries'
import { resolvePreIpoCompanyId } from '~/containers/PreIPO/server/routes'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect, safeDecodeURIComponent } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'pre-ipo/[company]',
	async ({ params }: GetStaticPropsContext<{ company: string }>) => {
		if (!params?.company) return { notFound: true }

		const companyParam = safeDecodeURIComponent(params.company)
		const metadata = await import('~/utils/metadata').then((module) => module.default)
		const company = resolvePreIpoCompanyId(companyParam, metadata)
		if (!company) return { notFound: true }

		if (companyParam !== company) {
			return canonicalRouteRedirect(`/pre-ipo/${encodeURIComponent(company)}`)
		}

		const props = await getPreIpoCompanyPageData(company)
		return { props, revalidate: maxAgeForNext([30]) }
	}
)

export async function getStaticPaths() {
	if (SKIP_BUILD_STATIC_GENERATION) return { paths: [], fallback: 'blocking' as const }

	const { getPreIpoCompanyStaticPaths } = await import('~/containers/PreIPO/server/routes')
	return { paths: await getPreIpoCompanyStaticPaths(), fallback: 'blocking' as const }
}

export default function PreIpoCompanyDetailPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title={`${props.summary.name} Pre-IPO Valuation - DefiLlama`}
			description={`Track ${props.summary.name} private-market valuation history, funding rounds, and tradable pre-IPO markets.`}
			canonicalUrl={`/pre-ipo/${props.summary.id}`}
			pageName={['Pre-IPO', props.summary.name]}
		>
			<PreIpoCompanyPage {...props} />
		</Layout>
	)
}
