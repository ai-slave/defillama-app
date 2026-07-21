import * as React from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS } from '~/constants/colors'
import { GovernanceTable } from '~/containers/Governance/GovernanceTable'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { TagGroup } from '~/ui/SegmentedControl'
import { InlineStatStrip, type InlineStatStripItem } from '~/ui/SummaryStats'
import { formattedNum } from '~/utils'
import type { GovernanceDataEntry, GovernanceType } from './types'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

const EMPTY_ACTIVITY_DATASET: MultiSeriesChartDataset = {
	source: [],
	dimensions: ['timestamp', 'Total', 'Successful']
}
const EMPTY_MAXVOTES_DATASET: MultiSeriesChartDataset = { source: [], dimensions: ['timestamp', 'Max Votes'] }

const ACTIVITY_CHARTS: IMultiSeriesChartProps['charts'] = [
	{ type: 'bar', name: 'Total', encode: { x: 'timestamp', y: 'Total' }, color: CHART_COLORS[0] },
	{ type: 'bar', name: 'Successful', encode: { x: 'timestamp', y: 'Successful' }, color: CHART_COLORS[1] }
]

const MAX_VOTES_CHARTS: IMultiSeriesChartProps['charts'] = [
	{ type: 'bar', name: 'Max Votes', encode: { x: 'timestamp', y: 'Max Votes' }, color: CHART_COLORS[2] }
]

type GovernanceTypeLabel = 'Snapshot' | 'Compound' | 'Tally'

function governanceTypeToLabel(t: string): GovernanceTypeLabel {
	return t === 'snapshot' ? 'Snapshot' : t === 'compound' ? 'Compound' : 'Tally'
}

interface GovernanceProjectProps {
	projectName: string
	governanceData: GovernanceDataEntry[]
	governanceTypes: GovernanceType[]
	initialCategoryIndex?: number
}

export default function GovernanceProject({
	projectName,
	governanceData,
	governanceTypes,
	initialCategoryIndex = 0
}: GovernanceProjectProps) {
	const [categoryIndex, setCategoryIndex] = React.useState(initialCategoryIndex)

	const categoryLabels = React.useMemo<GovernanceTypeLabel[]>(
		() => (governanceTypes ?? []).map(governanceTypeToLabel),
		[governanceTypes]
	)

	const safeCategoryIndex = categoryIndex >= 0 && categoryIndex < governanceData.length ? categoryIndex : 0
	const data = governanceData?.[safeCategoryIndex]
	const governanceType = governanceTypes?.[safeCategoryIndex] ?? 'tally'
	const governanceLabel =
		categoryLabels[safeCategoryIndex] ?? categoryLabels[0] ?? governanceTypeToLabel(governanceType)

	const filters =
		categoryLabels.length > 1 ? (
			<TagGroup
				variant="default"
				size="md"
				selectedValue={categoryLabels[safeCategoryIndex] ?? categoryLabels[0]}
				setValue={(value) => {
					const idx = categoryLabels.indexOf(value as GovernanceTypeLabel)
					if (idx === -1) return
					setCategoryIndex(idx)
				}}
				values={categoryLabels}
				className="ml-auto"
			/>
		) : null

	const activityDataset = React.useMemo<MultiSeriesChartDataset>(() => {
		const source = (data?.activity ?? []).map((row) => [Number(row.date) * 1e3, row.Total ?? 0, row.Successful ?? 0])
		return { source, dimensions: ['timestamp', 'Total', 'Successful'] }
	}, [data?.activity])

	const maxVotesDataset = React.useMemo<MultiSeriesChartDataset>(() => {
		const source = (data?.maxVotes ?? []).map((row) => [
			Number(row.date) * 1e3,
			row['Max Votes'] == null ? 0 : Number(row['Max Votes'])
		])
		return { source, dimensions: ['timestamp', 'Max Votes'] }
	}, [data?.maxVotes])

	const name = data?.metadata?.name ?? projectName

	const governanceStatItems: InlineStatStripItem[] = []
	if (data?.stats?.chainName != null) {
		governanceStatItems.push({
			label: 'Chain',
			value: (
				<span className="flex items-center gap-1">
					<TokenLogo name={data.stats.chainName} kind="chain" size={20} alt={`Logo of ${data.stats.chainName}`} />
					<span>{data.stats.chainName}</span>
				</span>
			)
		})
	}
	if (data?.stats?.proposalsCount != null) {
		governanceStatItems.push({ label: 'Total Proposals', value: data.stats.proposalsCount })
	}
	if (data?.stats?.successfulProposals != null) {
		governanceStatItems.push({ label: 'Successful', value: data.stats.successfulProposals })
	}
	if (data?.stats?.proposalsInLast30Days != null) {
		governanceStatItems.push({ label: 'Proposals (30d)', value: data.stats.proposalsInLast30Days })
	}
	if (data?.stats?.successfulProposalsInLast30Days != null) {
		governanceStatItems.push({ label: 'Successful (30d)', value: data.stats.successfulProposalsInLast30Days })
	}
	if (data?.stats?.highestTotalScore != null) {
		governanceStatItems.push({ label: 'Max Total Votes', value: formattedNum(data.stats.highestTotalScore) })
	}
	if (data?.metadata?.followersCount != null) {
		governanceStatItems.push({ label: 'Followers', value: formattedNum(data.metadata.followersCount) })
	}

	return (
		<>
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-surface p-3">
					<TokenLogo name={name} kind="token" alt={`Logo of ${name}`} />
					<h1 className="heading-sm">{name}</h1>
					{filters}
				</div>

				{governanceStatItems.length > 0 ? <InlineStatStrip items={governanceStatItems} /> : null}

				<div className="grid grid-cols-2 gap-2">
					<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
						<React.Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								title="Activity"
								dataset={activityDataset?.source?.length > 0 ? activityDataset : EMPTY_ACTIVITY_DATASET}
								charts={ACTIVITY_CHARTS}
								valueSymbol=""
								exportButtons={{
									png: true,
									csv: true,
									filename: `${name}-${governanceLabel}-activity`,
									pngTitle: `${name} ${governanceLabel} Governance Activity`
								}}
							/>
						</React.Suspense>
					</ChartPanel>
					<ChartPanel className="col-span-full xl:col-span-1 xl:[&:last-child:nth-child(2n-1)]:col-span-full">
						<React.Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								title="Max Votes"
								dataset={maxVotesDataset?.source?.length > 0 ? maxVotesDataset : EMPTY_MAXVOTES_DATASET}
								charts={MAX_VOTES_CHARTS}
								valueSymbol=""
								exportButtons={{
									png: true,
									csv: true,
									filename: `${name}-${governanceLabel}-max-votes`,
									pngTitle: `${name} ${governanceLabel} Max Votes`
								}}
							/>
						</React.Suspense>
					</ChartPanel>
				</div>
			</div>
			{data != null ? <GovernanceTable data={data} governanceType={governanceType} /> : null}
		</>
	)
}
