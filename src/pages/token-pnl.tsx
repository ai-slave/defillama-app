import { DEFAULT_TOKEN_PNL_TOKEN_IDS, TokenPnl } from '~/containers/TokenPnl'
import { getInitialTokenSearchOptions } from '~/containers/TokenSearch/search'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('token-pnl', async () => {
	const initialTokenOptions = await getInitialTokenSearchOptions(DEFAULT_TOKEN_PNL_TOKEN_IDS)
	return {
		props: {
			initialTokenOptions,
			generatedAtSec: Math.floor(Date.now() / 1000)
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Token PNL']

export default function TokenPnlPage({
	initialTokenOptions,
	generatedAtSec
}: {
	initialTokenOptions: Array<TokenSearchResult>
	generatedAtSec: number
}) {
	return (
		<Layout
			title="Token Profit & Loss (PnL) Tracker - DefiLlama"
			description="Calculate profit and loss for any DeFi token. Track entry price, current value, and returns on DefiLlama."
			canonicalUrl="/token-pnl"
			pageName={pageName}
		>
			<TokenPnl initialTokenOptions={initialTokenOptions} generatedAtSec={generatedAtSec} />
		</Layout>
	)
}
