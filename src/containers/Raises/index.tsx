import { useRouter } from 'next/router'
import * as React from 'react'
import { Announcement } from '~/components/Announcement'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { RaisesFilters } from '~/containers/Raises/Filters'
import { Button } from '~/ui/Button'
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
				<Button
					as="a"
					href="https://airtable.com/shrON6sFMgyFGulaq"
					target="_blank"
					rel="noopener noreferrer"
					variant="inlineLink"
				>
					Add it here!
				</Button>
				<br />
				<span>
					Are you a VC and want to submit your investments in bulk? Email them to us at{' '}
					<Button as="a" href="mailto:support@defillama.com" variant="inlineLink">
						support@defillama.com
					</Button>
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
