import { useRouter } from 'next/router'
import * as React from 'react'
import { Announcement } from '~/components/Announcement'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { RaisesFilters } from '~/containers/Raises/Filters'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { useRaisesData } from './hooks'
import type { Raise } from './model'
import { RaisesTotal } from './RaisesTotal'
import { RaisesTable } from './Table'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

interface RaisesContainerProps {
	raises: Array<Raise>
	investors: Array<string>
	rounds: Array<string>
	sectors: Array<string>
	chains: Array<string>
	investorName: string | null
}

function RaisesContainer({ raises, investors, rounds, sectors, chains, investorName }: RaisesContainerProps) {
	const { pathname } = useRouter()

	const { filteredRaisesList, hasActiveFilters, amountQuickPicks, fundingSummary, monthlyInvestmentChart } =
		useRaisesData({
			raises,
			investors,
			rounds,
			sectors,
			chains
		})
	const deferredMonthlyInvestmentChart = React.useDeferredValue(monthlyInvestmentChart)
	const monthlyInvestmentTitle = investorName ? `${investorName} Monthly Funding` : 'Monthly Funding'

	return (
		<>
			<Announcement notCancellable>
				<span>Are we missing any funding round?</span>{' '}
				<a
					href="https://airtable.com/shrON6sFMgyFGulaq"
					className="font-medium text-link underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					Add it here!
				</a>
				<br />
				<span>
					Are you a VC and want to submit your investments in bulk? Email them to us at{' '}
					<a href="mailto:support@defillama.com" className="text-link underline">
						support@defillama.com
					</a>
				</span>
			</Announcement>
			<RaisesFilters
				hasActiveFilters={hasActiveFilters}
				amountQuickPicks={amountQuickPicks}
				header={investorName ? `${investorName} raises` : 'Raises'}
				headingAs="h1"
				rounds={rounds}
				sectors={sectors}
				investors={investors}
				chains={chains}
				pathname={pathname}
			/>

			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					<StatItem label="Total Funding Rounds" value={filteredRaisesList.length} />
					<StatItem label="Total Funding Amount" value={<RaisesTotal {...fundingSummary} />} />
				</SummaryStatsCard>

				<Panel className="col-span-2">
					<React.Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							dataset={deferredMonthlyInvestmentChart.dataset}
							charts={deferredMonthlyInvestmentChart.charts}
							valueSymbol="$"
							groupBy="monthly"
							exportButtons={{
								png: true,
								csv: true,
								filename: 'monthly-funding',
								pngTitle: monthlyInvestmentTitle
							}}
						/>
					</React.Suspense>
				</Panel>
			</SummaryCardGrid>

			<RaisesTable raises={filteredRaisesList} />
		</>
	)
}

export default RaisesContainer
