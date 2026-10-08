import type { InferGetStaticPropsType } from 'next'
import { getRwaPageMeta } from '~/containers/RWA/layout/pageCopy'
import { RWAPerpsTreePage } from '~/containers/RWA/layout/PerpsTreePage'
import { fetchRwaPageQuestions } from '~/containers/RWA/layout/questions.server'
import { unpackRwaPerpsMarkets } from '~/containers/RWA/perpsPayload'
import { getRWAPerpsPageProps } from '~/containers/RWA/perpsQueries'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

/* The Perps tab: the /rwa overview container with perps rows only; /rwa?perps=true redirects here. */
export const getStaticProps = withPerformanceLogging(`rwa/perps/index`, async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const props = await getRWAPerpsPageProps({
		scope: { kind: 'all' },
		perpsAssetGroups: metadataCache.rwaPerpsList.assetGroups,
		rwaPlatformsIndex: metadataCache.rwaPlatformsIndex
	})

	if (!props) throw new Error('Missing page data for route=/rwa/perps')

	const entityQuestions = await fetchRwaPageQuestions({
		kind: 'perpsOverview',
		scopeName: null,
		rows: unpackRwaPerpsMarkets(props.markets)
	})

	return {
		props: { ...props, entityQuestions },
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['RWA Perps']
const meta = getRwaPageMeta('perpsOverview', null)

export default function RWAPerpsPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAPerpsTreePage {...props} pageKind="perpsOverview" />
		</Layout>
	)
}
