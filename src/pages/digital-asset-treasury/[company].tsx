import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { DATCompany } from '~/containers/DAT/Company'
import { getDATCompanyData } from '~/containers/DAT/queries'
import Layout from '~/layout'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect, safeDecodeURIComponent } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'digital-asset-treasury/[company]',
	async ({ params }: GetStaticPropsContext<{ company: string }>) => {
		if (!params?.company) {
			return { notFound: true }
		}

		const companyParam = safeDecodeURIComponent(params.company)
		const company = slug(companyParam)
		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const canonicalCompany = metadataCache.digitalAssetTreasuryCompanyRouteBySlug[company]
		if (!canonicalCompany) {
			return { notFound: true }
		}

		if (companyParam !== canonicalCompany) {
			return canonicalRouteRedirect(`/digital-asset-treasury/${encodeURIComponent(canonicalCompany)}`)
		}

		const props = await getDATCompanyData(company)

		if (!props) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		return {
			props: { ...props, canonicalCompanyRoute: canonicalCompany },
			revalidate: maxAgeForNext([22])
		}
	}
)

export async function getStaticPaths() {
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	const { getDATCompanyStaticPaths } = await import('~/containers/DAT/server/routes')
	const paths = await getDATCompanyStaticPaths()
	return { paths, fallback: 'blocking' }
}

export default function DigitalAssetTreasuryPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title={`${props.name} Digital Asset Treasury - DefiLlama`}
			description={`Track ${props.name}'s live digital asset treasury holdings, cost basis, average purchase price, mNAV, share price and acquisition timeline.`}
			canonicalUrl={`/digital-asset-treasury/${encodeURIComponent(props.canonicalCompanyRoute)}`}
		>
			<DATCompany {...props} />
		</Layout>
	)
}
