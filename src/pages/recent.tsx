import type { InferGetStaticPropsType } from 'next'
import { RecentlyListedProtocolsTable } from '~/containers/ProtocolLists/RecentProtocolsTable'
import { getProtocolListInitialProps } from '~/containers/ProtocolLists/server/tableData.server'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('recent', async () => {
	const data = await getProtocolListInitialProps('recent')

	return {
		props: data,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Recently Listed Protocols']

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Recently Listed DeFi Protocols - DefiLlama"
			description="Discover the newest DeFi protocols listed on DefiLlama with TVL, chain, and category data."
			canonicalUrl="/recent"
			pageName={pageName}
		>
			<RecentlyListedProtocolsTable {...props} />
		</Layout>
	)
}
