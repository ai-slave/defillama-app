import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import TokensPage from '~/containers/Tokens'
import { getTokensCacheControl } from '~/containers/Tokens/cache.server'
import { getTokensInitialPageSnapshot } from '~/containers/Tokens/queries.server'
import type { TokensPageProps } from '~/containers/Tokens/types'
import Layout from '~/layout'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

const getServerSidePropsHandler: GetServerSideProps<TokensPageProps> = async ({ res }) => {
	const snapshot = await getTokensInitialPageSnapshot()
	res.setHeader('Cache-Control', getTokensCacheControl(snapshot.revision))
	return {
		props: { initialData: snapshot.data, initialChartData: snapshot.chartData }
	}
}

export const getServerSideProps = withServerSidePropsTelemetry('/tokens', getServerSidePropsHandler)

const pageName = ['Tokens']

export default function Tokens(data: InferGetServerSidePropsType<typeof getServerSideProps>) {
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
