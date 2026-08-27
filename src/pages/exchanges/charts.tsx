import type { DepthCurveRow } from '~/containers/Exchanges/depthCurve'
import { ExchangeAccessGate } from '~/containers/Exchanges/ExchangeAccessGate'
import { ExchangeResearch } from '~/containers/Exchanges/ExchangeResearch'
import { ExchangesNav } from '~/containers/Exchanges/ExchangesNav'
import { fetchExchangeResearchReport } from '~/containers/Exchanges/master.api'
import type { ExchangeDirectoryRowModel } from '~/containers/Exchanges/models'
import { loadMasterExchangeDirectory, loadMasterResearchReports } from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

/** The depth curve reads four fields per venue. Passing whole directory rows would put
 *  the entire listing payload into this page's props for a chart that ignores it. */
function depthRowsFrom(rows: ExchangeDirectoryRowModel[]): DepthCurveRow[] {
	return rows.flatMap((row) => {
		const spot = row.segments.spot?.depthLadder ?? null
		const perp = row.segments.linear_perp?.depthLadder ?? null
		if (!spot?.length && !perp?.length) return []
		return [
			{
				slug: row.slug,
				name: row.name,
				liquidity: { spot: row.liquidity?.spot ?? null, linear_perp: row.liquidity?.linear_perp ?? null },
				segments: {
					...(spot?.length ? { spot: { depthLadder: spot } } : null),
					...(perp?.length ? { linear_perp: { depthLadder: perp } } : null)
				}
			}
		]
	})
}

export const getStaticProps = withPerformanceLogging('exchanges/charts', async () => {
	const [, directory] = await Promise.all([loadMasterResearchReports(), loadMasterExchangeDirectory()])
	return { props: { depthRows: depthRowsFrom(directory.rows) }, revalidate: maxAgeForNext([22]) }
})

export const EXCHANGE_RESEARCH_PAGE_METADATA = {
	title: 'Exchange Research Charts - DefiLlama',
	description:
		'Compare historical exchange volume, open interest, order-book depth, and liquidity-normalized volume across selectable ranges.',
	canonicalUrl: '/exchanges/charts',
	pageName: ['Exchanges']
}

export default function ExchangeChartsPage({ depthRows }: { depthRows: DepthCurveRow[] }) {
	return (
		<ExchangeAccessGate>
			<Layout {...EXCHANGE_RESEARCH_PAGE_METADATA}>
				<ExchangesNav activePage="charts" />
				<ExchangeResearch loadReport={fetchExchangeResearchReport} depthRows={depthRows} />
			</Layout>
		</ExchangeAccessGate>
	)
}
