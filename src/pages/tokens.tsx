import TokensPage from '~/containers/Tokens'
import { getTokensPageData } from '~/containers/Tokens/queries.server'
import type { TokensPageProps } from '~/containers/Tokens/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('tokens', async () => {
	return {
		props: {
			initialData: await getTokensPageData()
		},
		revalidate: maxAgeForNext([23])
	}
})

const pageName = ['Tokens']

export default function Tokens(data: TokensPageProps) {
	return (
		<Layout
			title="Crypto Token Rankings: Prices, MCap & Unlocks - DefiLlama"
			description="Compare crypto tokens by price, market cap, FDV, volume, revenue, unlocks, emissions, and token rights. Search live token rankings across tracked crypto assets."
			canonicalUrl="/tokens"
			pageName={pageName}
		>
			<TokensPage {...data} />
		</Layout>
	)
}
