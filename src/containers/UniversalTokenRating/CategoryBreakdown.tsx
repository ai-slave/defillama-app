import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { GradeBadge, ScoreBar } from './grades'
import type { UtrCategoryBreakdown, UtrGradeScaleEntry, UtrRubricScore } from './types'

export type BreakdownColumn = {
	key: string
	label: string
	grade: string | null
	score: number | null
	percentile: number | null
}

const CATEGORY_ORDER = [
	'core_contributors',
	'legal_financial',
	'tokenomics_d',
	'service_providers',
	'total_market',
	'market_makers',
	'liquidity_footprint',
	'tokenomics_p'
]

export function columnsFromCategories(categories: UtrCategoryBreakdown[]): BreakdownColumn[] {
	return categories
		.map((category) => ({
			key: category.key,
			label: category.label,
			grade: category.grade,
			score: category.score,
			percentile: category.percentile
		}))
		.sort((a, b) => {
			const aIndex = CATEGORY_ORDER.indexOf(a.key)
			const bIndex = CATEGORY_ORDER.indexOf(b.key)
			return (aIndex === -1 ? CATEGORY_ORDER.length : aIndex) - (bIndex === -1 ? CATEGORY_ORDER.length : bIndex)
		})
}

export function columnsFromRubrics(rubrics: UtrRubricScore[]): BreakdownColumn[] {
	return rubrics.map((rubric) => ({
		key: rubric.rubric,
		label: rubric.rubric,
		grade: null,
		score: rubric.percentage == null ? null : rubric.percentage / 10,
		percentile: rubric.percentile
	}))
}

function PercentileCell({ percentile }: { percentile: number | null }) {
	const width = Math.max(0, Math.min(100, percentile ?? 0))
	return (
		<span className="flex items-center justify-between gap-2">
			<span className="font-jetbrains tabular-nums">
				{percentile == null
					? 'N/A'
					: formatPercent(percentile, {
							input: 'percent',
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
							smallValueDisplay: 'rounded',
							useGrouping: false
						})}
			</span>
			<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
				<span className="block h-full rounded-full bg-(--text-primary)" style={{ width: `${width}%` }} />
			</span>
		</span>
	)
}

export function CategoryBreakdownTable({
	title,
	columns,
	gradingScale
}: {
	title: string
	columns: BreakdownColumn[]
	gradingScale?: UtrGradeScaleEntry[] | null
}) {
	return (
		<div className="overflow-x-auto rounded-lg border border-subtle bg-surface">
			<p className="border-b border-subtle px-4 py-2.5 label-md">{title}</p>
			<table className="w-full border-collapse body-sm">
				<tbody>
					<tr className="border-b border-subtle">
						<th className="w-[110px] px-4 py-2 text-left label-sm text-secondary">Category</th>
						{columns.map((column) => (
							<th key={column.key} className="border-l border-subtle px-4 py-2 text-center label-sm text-secondary">
								{column.label}
							</th>
						))}
					</tr>
					<tr className="border-b border-subtle">
						<td className="px-4 py-2 text-secondary">Grade</td>
						{columns.map((column) => (
							<td key={column.key} className="border-l border-subtle px-4 py-2 text-center">
								<GradeBadge score={column.score} scale={10} grade={column.grade} gradingScale={gradingScale} />
							</td>
						))}
					</tr>
					<tr className="border-b border-subtle">
						<td className="px-4 py-2 text-secondary">Score</td>
						{columns.map((column) => (
							<td key={column.key} className="border-l border-subtle px-4 py-2">
								<span className="flex items-center justify-between gap-2">
									<span className="font-jetbrains tabular-nums">
										{column.score == null
											? 'N/A'
											: formatNumber(column.score, {
													minimumFractionDigits: 1,
													maximumFractionDigits: 1,
													useGrouping: false
												})}
										<span className="text-tertiary"> /10</span>
									</span>
									<ScoreBar
										score={column.score}
										scale={10}
										grade={column.grade}
										gradingScale={gradingScale}
										showValue={false}
									/>
								</span>
							</td>
						))}
					</tr>
					<tr>
						<td className="px-4 py-2 text-secondary">Percentile</td>
						{columns.map((column) => (
							<td key={column.key} className="border-l border-subtle px-4 py-2">
								<PercentileCell percentile={column.percentile} />
							</td>
						))}
					</tr>
				</tbody>
			</table>
		</div>
	)
}

export function rowBreakdownColumns(row: {
	breakdown?: { disclosure: UtrCategoryBreakdown[]; performance: UtrCategoryBreakdown[] }
	scores: { disclosureRubrics: UtrRubricScore[]; performanceRubrics: UtrRubricScore[] }
}): { disclosure: BreakdownColumn[]; performance: BreakdownColumn[] } {
	return {
		disclosure: row.breakdown?.disclosure.length
			? columnsFromCategories(row.breakdown.disclosure)
			: columnsFromRubrics(row.scores.disclosureRubrics),
		performance: row.breakdown?.performance.length
			? columnsFromCategories(row.breakdown.performance)
			: columnsFromRubrics(row.scores.performanceRubrics)
	}
}
