import type { InferGetStaticPropsType } from 'next'
import { RWAOverview } from '~/containers/RWA'
import { getRwaPageMeta } from '~/containers/RWA/layout/pageCopy'
import { fetchRwaPageQuestions } from '~/containers/RWA/layout/questions.server'
import { getRWAAssetsOverview } from '~/containers/RWA/queries'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging(`rwa/index`, async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const rwaList = metadataCache.rwaList
	const props = await getRWAAssetsOverview({ rwaList, rwaPlatformsIndex: metadataCache.rwaPlatformsIndex })

	if (!props) return { notFound: true, revalidate: maxAgeForNext([22]) }

	const entityQuestions = await fetchRwaPageQuestions({
		kind: 'overview',
		scopeName: null,
		rows: props.assets,
		defaultInclusion: props.defaultInclusion
	})

	return {
		props: { ...props, entityQuestions },
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['RWA']
const meta = getRwaPageMeta('overview', null)

export default function RWAPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAOverview {...props} pageKind="overview" />
		</Layout>
	)
}
