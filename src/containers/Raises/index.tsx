import { useRouter } from 'next/router'
import * as React from 'react'
import { Announcement } from '~/components/Announcement'
import type { IMultiSeriesChart2Props } from '~/components/ECharts/types'
import { RaisesFilters } from '~/containers/Raises/Filters'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formattedNum } from '~/utils'
import { useRaisesData } from './hooks'
import { RaisesTable } from './Table'
import type { IRaise } from './types'

const MultiSeriesChart2 = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

interface RaisesContainerProps {
	raises: IRaise[]
	investors: string[]
	rounds: string[]
	sectors: string[]
	chains: string[]
	investorName: string | null
}

const RaisesContainer = ({ raises, investors, rounds, sectors, chains, investorName }: RaisesContainerProps) => {
	const { pathname } = useRouter()

	const {
		filteredRaisesList,
		selectedInvestors,
		selectedRounds,
		selectedChains,
		selectedSectors,
		totalAmountRaised,
		monthlyInvestmentChart
	} = useRaisesData({
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
					className="font-medium text-(--legacy-blue) underline"
					target="_blank"
					rel="noopener noreferrer"
				>
					Add it here!
				</a>
				<br />
				<span>
					Are you a VC and want to submit your investments in bulk? Email them to us at{' '}
					<a href="mailto:support@defillama.com" className="text-(--legacy-blue) underline">
						support@defillama.com
					</a>
				</span>
			</Announcement>
			<RaisesFilters
				header={investorName ? `${investorName} raises` : 'Raises'}
				headingAs="h1"
				rounds={rounds}
				selectedRounds={selectedRounds}
				sectors={sectors}
				selectedSectors={selectedSectors}
				investors={investors}
				selectedInvestors={selectedInvestors}
				chains={chains}
				selectedChains={selectedChains}
				pathname={pathname}
			/>

			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					<StatItem label="Total Funding Rounds" value={filteredRaisesList.length} />
					<StatItem label="Total Funding Amount" value={`$${formattedNum(totalAmountRaised)}`} />
				</SummaryStatsCard>

				<ChartPanel className="col-span-2">
					<React.Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart2
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
				</ChartPanel>
			</SummaryCardGrid>

			<RaisesTable raises={filteredRaisesList} />
		</>
	)
}

export default RaisesContainer
