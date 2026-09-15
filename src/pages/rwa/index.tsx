import type { InferGetStaticPropsType } from 'next'
import { RWAOverview } from '~/containers/RWA'
import { getRWAAssetsOverview } from '~/containers/RWA/queries'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging(`rwa/index`, async () => {
	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const rwaList = metadataCache.rwaList
	const props = await getRWAAssetsOverview({ rwaList, rwaPlatformsIndex: metadataCache.rwaPlatformsIndex })

	if (!props) return { notFound: true, revalidate: maxAgeForNext([22]) }

	return {
		props,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['RWA']

export default function RWAPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Real World Assets (RWA) Dashboard & Analytics - DefiLlama"
			description="Track Real World Assets (RWA) tokenization on-chain. View tokenized treasuries, private credit, real estate, and commodities. RWA AUM, yields, and adoption analytics across all blockchains."
			pageName={pageName}
			canonicalUrl="/rwa"
		>
			<RWAOverview {...props} />
		</Layout>
	)
}
