import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SectorDetailPage } from '~/containers/Equities/SectorDetailPage'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'equities/sectors/[sector]',
	async ({ params }: GetStaticPropsContext<{ sector: string }>) => {
		if (!params?.sector) return { notFound: true }
		const { EQUITIES_SECTOR_SLUGS, loadEquitiesSectorPageData } =
			await import('~/containers/Equities/server/marketData.server')
		const sectorSlug = params.sector.toLowerCase()
		if (!EQUITIES_SECTOR_SLUGS.some((slug) => slug === sectorSlug)) return { notFound: true }
		if (params.sector !== sectorSlug) return canonicalRouteRedirect(`/equities/sectors/${sectorSlug}`)

		return {
			props: {
				sectorSlug,
				state: await loadEquitiesSectorPageData(sectorSlug as (typeof EQUITIES_SECTOR_SLUGS)[number])
			},
			revalidate: maxAgeForNext([5])
		}
	}
)

export async function getStaticPaths() {
	const { EQUITIES_SECTOR_SLUGS } = await import('~/containers/Equities/server/marketData.server')
	return {
		paths: EQUITIES_SECTOR_SLUGS.map((sector) => ({ params: { sector } })),
		fallback: 'blocking' as const
	}
}

export default function EquitySectorDetailRoute({ state, sectorSlug }: InferGetStaticPropsType<typeof getStaticProps>) {
	const sectorName = state.status === 'ready' ? state.data.sector.sector : sectorSlug.replaceAll('-', ' ')
	return (
		<Layout
			title={`${sectorName} Equity Sector - DefiLlama`}
			description={`Track ${sectorName} equities, industries, market capitalization, performance, valuation, and concentration.`}
			canonicalUrl={`/equities/sectors/${sectorSlug}`}
			pageName={['Equity Sectors']}
		>
			<SectorDetailPage state={state} />
		</Layout>
	)
}
