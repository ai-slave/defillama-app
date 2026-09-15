import type { DepthCurveRow } from '~/containers/Exchanges/depthCurve'
import { ExchangeResearch } from '~/containers/Exchanges/ExchangeResearch'
import { ExchangesNav } from '~/containers/Exchanges/ExchangesNav'
import { fetchExchangeResearchReport } from '~/containers/Exchanges/master.api'
import { mapBtcExecutionTable } from '~/containers/Exchanges/master.mappers'
import type { BtcExecutionRowModel, ExchangeDirectoryRowModel } from '~/containers/Exchanges/models'
import {
	loadMasterExchangeDirectoryWithExecution,
	loadMasterResearchReports
} from '~/containers/Exchanges/server/master.loaders'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

/** The depth curve reads four fields per venue. Passing whole directory rows would put
 *  the entire listing payload into this page's props for a chart that ignores it. */
function depthRowsFrom(rows: Array<ExchangeDirectoryRowModel>): Array<DepthCurveRow> {
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
	// One execution-quality fetch feeds both the directory mapping and the BTC table,
	// so the two never read different snapshots; it stays fail-soft — a missing file
	// renders the page without the BTC execution table.
	const [, { directory, execution }] = await Promise.all([
		loadMasterResearchReports(),
		loadMasterExchangeDirectoryWithExecution()
	])
	return {
		props: {
			depthRows: depthRowsFrom(directory.rows),
			btcExecutionRows: mapBtcExecutionTable(directory.rows, execution)
		},
		revalidate: maxAgeForNext([22])
	}
})

export const EXCHANGE_RESEARCH_PAGE_METADATA = {
	title: 'Exchange Research Charts - DefiLlama',
	description:
		'Compare historical exchange volume, open interest, order-book depth, and liquidity-normalized volume across selectable ranges.',
	canonicalUrl: '/exchanges/charts',
	pageName: ['Exchanges']
}

export default function ExchangeChartsPage({
	depthRows,
	btcExecutionRows
}: {
	depthRows: Array<DepthCurveRow>
	btcExecutionRows: Array<BtcExecutionRowModel>
}) {
	return (
		<Layout {...EXCHANGE_RESEARCH_PAGE_METADATA}>
			<ExchangesNav activePage="charts" />
			<ExchangeResearch
				loadReport={fetchExchangeResearchReport}
				depthRows={depthRows}
				btcExecutionRows={btcExecutionRows}
			/>
		</Layout>
	)
}
