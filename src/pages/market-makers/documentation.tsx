import { MarketMakersAccessGate } from '~/containers/MarketMakers/AccessGate'
import { MarketMakersDocumentation } from '~/containers/MarketMakers/Documentation'
import Layout from '~/layout'

export default function MarketMakersDocumentationPage() {
	return (
		<Layout
			title="Market Maker Leaderboard Documentation - DefiLlama"
			description="How the Forgd Market Maker leaderboards are calculated: Performance Index, Depth, Volume, Spread, and KPI Adherence methodology and glossary."
			canonicalUrl="/market-makers/documentation"
			pageName={['Market Makers', 'Documentation']}
		>
			<MarketMakersAccessGate>
				<MarketMakersDocumentation />
			</MarketMakersAccessGate>
		</Layout>
	)
}
