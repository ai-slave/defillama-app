import { useMemo, useState, type ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { SecondaryBadge, StatusBadge } from '~/containers/MarketMakers/badges'
import { Drawer } from '~/containers/MarketMakers/Drawer'
import { forgdCtaSecondaryButtonStyles } from '~/containers/MarketMakers/styles'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { formatNumber } from '~/utils/numberFormat'
import { LISTING_STATUS_LABELS } from './constants'
import { resolveUtrGrade, utrGradeColor } from './gradeBands'
import { GradeBadge, GradeChip, ScoreBar } from './grades'
import {
	LpPerformanceBreakdown,
	LpPerformanceInsights,
	LpPerformanceSummary,
	LpUptimeCalculations
} from './LiquidityProviders'
import { getMockCandles, getMockSeries, MOCK_DISCLOSURE_SECTIONS, type MockDisclosureItem } from './mocks'
import { PreTgePerformance } from './PreTgePerformance'
import { buildCandleOption, buildSeriesOption, SimpleChart, useChartAxisColor, type SimpleSeries } from './SimpleChart'
import type { UtrLeaderboardRow } from './types'

function seedFor(asset: string, salt: number): number {
	return asset.length * 7919 + salt
}

export function GradeFooter({
	score,
	grade,
	percentile,
	divider = true
}: {
	score: number | null
	grade?: string | null
	percentile?: number | null
	divider?: boolean
}) {
	const percentileLabel = percentile == null ? 'N/A' : `${percentile.toFixed(2)}%`
	const percentileWidth = percentile == null ? 0 : Math.max(0, Math.min(100, percentile))
	return (
		<div
			className={`flex items-start justify-between gap-2 px-4 py-2.5 lg:items-center ${divider ? 'border-t border-subtle' : ''}`}
		>
			<span className="flex flex-col gap-1.5 label-sm text-secondary lg:flex-row lg:items-center lg:gap-2">
				Grade
				<GradeBadge score={score} scale={10} grade={grade} />
			</span>
			<span className="flex flex-col gap-1.5 label-sm text-secondary lg:flex-row lg:items-center lg:gap-2">
				Score
				<span className="flex items-center gap-2">
					<ScoreBar score={score} scale={10} grade={grade} />
					<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
				</span>
			</span>
			<span className="flex flex-col gap-1.5 label-sm text-secondary lg:flex-row lg:items-center lg:gap-2">
				Percentile
				<span className="flex items-center gap-2">
					<span className="font-jetbrains text-primary tabular-nums">{percentileLabel}</span>
					<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
						<span className="block h-full rounded-full bg-(--text-primary)" style={{ width: `${percentileWidth}%` }} />
					</span>
				</span>
			</span>
		</div>
	)
}

export function ClaimProfileBanner() {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand p-4">
			<div className="flex gap-3">
				<Icon name="shield-check" height={24} width={24} className="mt-0.5 shrink-0 text-on-brand" />
				<div className="flex flex-col gap-1">
					<p className="label-lg text-on-brand">Claim this token profile</p>
					<p className="body-sm text-on-brand/70">
						Core team members can claim this profile to verify project information and update disclosures.
					</p>
					<BasicLink
						href="/universal-token-rating/claim"
						className={`${forgdCtaSecondaryButtonStyles} mt-2 w-fit lg:hidden`}
					>
						Claim Token Profile
					</BasicLink>
				</div>
			</div>
			<BasicLink href="/universal-token-rating/claim" className={`${forgdCtaSecondaryButtonStyles} max-lg:hidden`}>
				Claim Token Profile
			</BasicLink>
		</div>
	)
}

export function GradeFooterColumns({
	score,
	grade,
	percentile
}: {
	score: number | null
	grade?: string | null
	percentile?: number | null
}) {
	const percentileLabel = percentile == null ? 'N/A' : `${percentile.toFixed(2)}%`
	const percentileWidth = percentile == null ? 0 : Math.max(0, Math.min(100, percentile))
	return (
		<div className="flex items-start gap-x-2 border-t border-subtle px-4 py-2.5">
			<div className="flex flex-col gap-1.5">
				<span className="label-sm text-secondary">Grade</span>
				<GradeBadge score={score} scale={10} grade={grade} />
			</div>
			<div className="flex-[2]" />
			<div className="flex flex-col gap-1.5">
				<span className="label-sm text-secondary">Score</span>
				<span className="flex items-center gap-2">
					<ScoreBar score={score} scale={10} grade={grade} />
					<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
				</span>
			</div>
			<div className="flex-[1]" />
			<div className="flex flex-col gap-1.5">
				<span className="label-sm text-secondary">Percentile</span>
				<span className="flex items-center gap-2">
					<span className="font-jetbrains label-sm text-primary tabular-nums">{percentileLabel}</span>
					<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
						<span className="block h-full rounded-full bg-(--text-primary)" style={{ width: `${percentileWidth}%` }} />
					</span>
				</span>
			</div>
		</div>
	)
}

export function GradeFooterStacked({
	score,
	grade,
	percentile
}: {
	score: number | null
	grade?: string | null
	percentile?: number | null
}) {
	const percentileLabel = percentile == null ? 'N/A' : `${percentile.toFixed(2)}%`
	const percentileWidth = percentile == null ? 0 : Math.max(0, Math.min(100, percentile))
	return (
		<div className="flex flex-col border-t border-subtle px-4 py-1.5">
			<div className="flex min-h-6 items-center justify-between gap-2">
				<span className="label-sm text-secondary">Grade</span>
				<GradeBadge score={score} scale={10} grade={grade} />
			</div>
			<div className="flex min-h-6 items-center justify-between gap-2">
				<span className="label-sm text-secondary">Score</span>
				<span className="flex items-center gap-2">
					<ScoreBar score={score} scale={10} grade={grade} />
					<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
				</span>
			</div>
			<div className="flex min-h-6 items-center justify-between gap-2">
				<span className="label-sm text-secondary">Percentile</span>
				<span className="flex items-center gap-2">
					<span className="font-jetbrains label-sm text-primary tabular-nums">{percentileLabel}</span>
					<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
						<span className="block h-full rounded-full bg-(--text-primary)" style={{ width: `${percentileWidth}%` }} />
					</span>
				</span>
			</div>
		</div>
	)
}

export function CantFindTokenBanner() {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand p-4">
			<div className="flex items-center gap-4">
				<img
					src="/market-makers-docs/circle-portal.svg"
					alt=""
					aria-hidden
					className="size-12 shrink-0 brightness-0 invert"
				/>
				<div className="flex flex-col gap-1">
					<p className="label-lg text-on-brand">Can’t Find Your Token?</p>
					<p className="body-sm text-on-brand/70">
						Create an account on Forgd to register your token and submit a request to be added to the Universal Token
						Rating.
					</p>
					<BasicLink
						href="/universal-token-rating/join"
						className={`${forgdCtaSecondaryButtonStyles} mt-2 w-fit lg:hidden`}
					>
						Join Forgd
					</BasicLink>
				</div>
			</div>
			<BasicLink href="/universal-token-rating/join" className={`${forgdCtaSecondaryButtonStyles} max-lg:hidden`}>
				Join Forgd
			</BasicLink>
		</div>
	)
}

export function NoDataPlaceholder() {
	return (
		<div className="flex min-h-[260px] flex-col items-center justify-center gap-1 rounded-lg bg-surface-elevated-1 p-6 text-center">
			<Icon name="bar-chart-2" height={24} width={24} className="text-tertiary" />
			<p className="label-md text-secondary">Data is not available</p>
			<p className="body-sm text-tertiary">Data will appear here once available.</p>
		</div>
	)
}

export function CardDivider() {
	return <div className="-mx-4 border-t border-subtle" />
}

export function KvTable({ rows }: { rows: [ReactNode, ReactNode][] }) {
	return (
		<div className="flex flex-col rounded-lg border border-subtle">
			{rows.map(([label, value], index) => (
				<div
					key={typeof label === 'string' ? label : index}
					className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-2 last:border-b-0"
				>
					<span className="body-sm text-secondary">{label}</span>
					<span className="font-jetbrains body-sm text-primary tabular-nums">{value}</span>
				</div>
			))}
		</div>
	)
}

export function MetricCard({
	title,
	badge,
	score,
	grade,
	percentile,
	onOpen,
	children
}: {
	title: string
	badge?: ReactNode
	score: number | null
	grade?: string | null
	percentile?: number | null
	onOpen?: () => void
	children: ReactNode
}) {
	return (
		<Panel padding="none">
			<div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
				<span className="flex flex-wrap items-center gap-2">
					<h3 className="label-lg">{title}</h3>
					{badge}
				</span>
				{onOpen ? (
					<Button type="button" size="sm" square aria-label={`Open ${title} details`} onClick={onOpen}>
						<Icon name="arrow-right" height={14} width={14} />
					</Button>
				) : null}
			</div>
			<div className="flex flex-1 flex-col gap-3 p-4">{children}</div>
			<GradeFooter score={score} grade={grade} percentile={percentile} divider={false} />
		</Panel>
	)
}

function DisclosureCard({
	title,
	items,
	onOpen
}: {
	title: string
	items: MockDisclosureItem[]
	onOpen: (item: MockDisclosureItem) => void
}) {
	return (
		<Panel padding="none">
			<div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
				<h3 className="label-lg">{title}</h3>
			</div>
			<div className="flex flex-col">
				{items.map((item) => (
					<button
						key={item.label}
						type="button"
						onClick={() => onOpen(item)}
						className="flex cursor-pointer items-center justify-between gap-3 border-b border-subtle px-4 py-2.5 text-left last:border-b-0 hover:bg-hover-row"
					>
						<span className="body-sm text-primary">{item.label}</span>
						<span className="flex items-center gap-2">
							<GradeBadge score={item.score} scale={10} />
							<span className="min-w-[8ch] text-right font-jetbrains body-sm tabular-nums">
								{item.score == null ? '0.0' : item.score.toFixed(1)}
								<span className="text-tertiary"> /10</span>
							</span>
						</span>
					</button>
				))}
			</div>
		</Panel>
	)
}

type DrawerState =
	| { kind: 'disclosure'; section: string; item: MockDisclosureItem }
	| {
			kind: 'metric'
			title: string
			score: number | null
			chart: 'series' | 'candles'
			seed: number
	  }
	| null

function TokenDrawer({ state, onClose }: { state: DrawerState; onClose: () => void }) {
	const axisColor = useChartAxisColor()
	if (!state) return null
	if (state.kind === 'disclosure') {
		return (
			<Drawer open onClose={onClose} title={`${state.section} — ${state.item.label}`}>
				<div className="flex flex-col gap-4 p-4">
					<div className="flex items-center gap-3">
						<GradeBadge score={state.item.score} scale={10} />
						<ScoreBar score={state.item.score} scale={10} />
					</div>
					<p className="body-lg text-secondary">
						{state.item.score == null
							? 'No disclosure has been submitted for this sub-criterion yet. Claim the token profile to add the underlying information and improve the score.'
							: 'Disclosure submitted and scored against the published rubric. Supporting documents and reviewer notes appear here once the live disclosure API ships.'}
					</p>
					<KvTable
						rows={[
							['Scored', state.item.score == null ? 'N/A' : `${state.item.score.toFixed(1)} /10`],
							['Last updated', 'Jan 01, 2026'],
							['Staleness penalty', state.item.score == null ? 'Not applicable' : 'None']
						]}
					/>
				</div>
			</Drawer>
		)
	}
	return (
		<Drawer open onClose={onClose} title={state.title} widthClassName="sm:max-w-2xl">
			<div className="flex flex-col gap-4 p-4">
				<div className="rounded-lg border border-subtle">
					<SimpleChart
						option={
							state.chart === 'candles'
								? buildCandleOption(getMockCandles(state.seed), axisColor)
								: buildSeriesOption(
										[
											{
												name: state.title,
												type: 'area',
												color: '#2172E5',
												data: getMockSeries(state.seed)
											}
										],
										axisColor
									)
						}
						className="h-[280px] w-full"
					/>
				</div>
				<KvTable
					rows={[
						['Previous 30D average', `$${formatNumber(85_090_876)}`],
						['Percentile', '85.28%'],
						['Data as of', '2026-08-09']
					]}
				/>
				<GradeFooter score={state.score} percentile={state.score == null ? null : 85.28} />
			</div>
		</Drawer>
	)
}

export function TickScoreStrip({
	label,
	score,
	gradeLabel
}: {
	label: string
	score: number | null
	gradeLabel?: string | null
}) {
	const grade = gradeLabel !== undefined ? gradeLabel : resolveUtrGrade(score, 10)
	const color = utrGradeColor((grade as Parameters<typeof utrGradeColor>[0]) ?? null)
	return (
		<div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
			<div className="flex items-center justify-between gap-2">
				<span className="label-md text-secondary">
					{label} <span className={color.text}>{grade ?? 'N/A'}</span>
				</span>
				<span className="font-jetbrains label-md tabular-nums">
					{score == null ? 'N/A' : score.toFixed(2)}
					<span className="text-tertiary"> /10</span>
				</span>
			</div>
			<span className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated-1">
				{score != null ? (
					<span
						className={`block h-full rounded-full ${color.solid}`}
						style={{ width: `${Math.min(100, score * 10)}%` }}
					/>
				) : null}
			</span>
		</div>
	)
}

export function TokenPage({ row }: { row: UtrLeaderboardRow }) {
	const axisColor = useChartAxisColor()
	const [drawer, setDrawer] = useState<DrawerState>(null)
	const TIER1_EXCHANGES = ['Binance', 'OKX', 'Coinbase', 'Upbit']
	const tier1Covered = ['Binance', 'OKX']
	const usd = (mock: number) => `$${formatNumber(mock)}`
	const pct = (mock: number) => `${mock.toFixed(2)}%`
	const isListed = row.listingStatus === 'listed'
	const disclosureScore = row.disclosureLevel === 'none' ? null : row.scores.disclosure
	const performanceScore = isListed ? row.scores.performance : null
	const disclosureSections = MOCK_DISCLOSURE_SECTIONS.map((section) => ({
		...section,
		items:
			row.disclosureLevel === 'none'
				? section.items.map((item) => ({ ...item, score: null }))
				: row.disclosureLevel === 'partial'
					? section.items.map((item, index) => (index % 2 === 0 ? item : { ...item, score: null }))
					: section.items
	}))

	const marketQualityCards = [
		{
			title: 'Total Volume (as % of Market Cap)',
			seed: seedFor(row.asset, 11),
			chart: 'series' as const,
			score: 6.5,
			series: [
				{
					name: 'Market Cap (USD)',
					type: 'area' as const,
					color: '#2172E5',
					data: getMockSeries(seedFor(row.asset, 11))
				},
				{
					name: 'Trade Volume (USD)',
					type: 'bar' as const,
					color: '#c0a03a',
					data: getMockSeries(seedFor(row.asset, 12), 30, 8_000_000)
				}
			],
			rows: [
				['Trade Volume (24h)', usd(85_090_876)],
				['Market Capitalization', usd(150_890_567)],
				['Trade Volume / Market Capitalization', pct(56.39)]
			] as [string, string][]
		},
		{
			title: 'Depth +/- 2% (as a % of Market Capitalization)',
			seed: seedFor(row.asset, 21),
			chart: 'series' as const,
			score: 8.6,
			series: [
				{
					name: 'Depth (+/- 2%)',
					type: 'line' as const,
					color: '#7c3aed',
					data: getMockSeries(seedFor(row.asset, 21), 30, 5_000_000, 0.7)
				},
				{
					name: 'Market Cap',
					type: 'line' as const,
					color: '#11935f',
					data: getMockSeries(seedFor(row.asset, 22), 30, 60_000_000, 0.4)
				}
			],
			rows: [
				['Depth +/- 2%', usd(5_248_245)],
				['Market Capitalization', usd(150_890_567)],
				['Depth / Market Capitalization', pct(3.48)]
			] as [string, string][]
		},
		{
			title: 'Bid / Ask Spread (Volume weighted spreads)',
			seed: seedFor(row.asset, 31),
			chart: 'series' as const,
			score: 5.5,
			series: [
				{
					name: 'Binance',
					type: 'line' as const,
					color: '#2172E5',
					data: getMockSeries(seedFor(row.asset, 31), 30, 40, 0.6)
				},
				{
					name: 'OKX',
					type: 'line' as const,
					color: '#7c3aed',
					data: getMockSeries(seedFor(row.asset, 32), 30, 25, 0.4)
				},
				{
					name: 'Gate.io',
					type: 'line' as const,
					color: '#11935f',
					data: getMockSeries(seedFor(row.asset, 33), 30, 18, 0.5)
				}
			],
			rows: [['Volume Weighted Bid / Ask Spread (VWAS)', '0.56%']] as [string, string][]
		},
		{
			title: 'Price Performance',
			seed: seedFor(row.asset, 41),
			chart: 'candles' as const,
			score: 8.5,
			series: null,
			rows: [
				['Count Green Candles', '25'],
				['Count Red Candles', '30'],
				['Candle "Win Rate"', '83.33%']
			] as [string, string][]
		},
		{
			title: 'Open Interest (as a % of Market Capitalization)',
			seed: seedFor(row.asset, 51),
			chart: 'series' as const,
			score: 8.2,
			series: [
				{
					name: 'Open Interest',
					type: 'bar' as const,
					color: '#c0a03a',
					data: getMockSeries(seedFor(row.asset, 51), 30, 5_690_345, 0.3)
				}
			],
			rows: [
				['Binance (Futures)', `$${formatNumber(5_690_345)}`],
				['Bybit (Futures)', `$${formatNumber(590_345)}`],
				['OKX (Futures)', `$${formatNumber(2_345)}`],
				['Open Interest / Market Capitalization', '3.01%']
			] as [string, string][]
		},
		{
			title: 'Funding Rate',
			seed: seedFor(row.asset, 61),
			chart: 'series' as const,
			score: 8.6,
			series: [
				{
					name: 'Binance',
					type: 'line' as const,
					color: '#c0a03a',
					data: getMockSeries(seedFor(row.asset, 61), 30, 20, 0.8)
				},
				{
					name: 'OKX',
					type: 'line' as const,
					color: '#2172E5',
					data: getMockSeries(seedFor(row.asset, 62), 30, 12, 0.6)
				}
			],
			rows: [['Open Interest-Weighted Funding Rate (7D avg)', '+0.5%']] as [string, string][]
		}
	]

	const footprintCards = useMemo(
		() => [
			{
				title: 'Total Volume (CEX vs DEX)',
				seed: seedFor(row.asset, 71),
				score: 8.5,
				names: ['CEX Volume', 'DEX Volume'],
				colors: ['#c0a03a', '#e6cf8b']
			},
			{
				title: 'Total +/-2% Depth (CEX vs DEX)',
				seed: seedFor(row.asset, 81),
				score: 8.5,
				names: ['CEX Depth', 'DEX Depth'],
				colors: ['#2172E5', '#93bbf5']
			},
			{
				title: 'Total Volume (Spot vs Perps)',
				seed: seedFor(row.asset, 91),
				score: 6.6,
				names: ['Spot Volume', 'Perps Volume'],
				colors: ['#c0a03a', '#e6cf8b']
			},
			{
				title: 'Total +/-2% Depth (Spot vs Perps)',
				seed: seedFor(row.asset, 101),
				score: 8.5,
				names: ['Spot Depth', 'Perps Depth'],
				colors: ['#2172E5', '#93bbf5']
			}
		],
		[row.asset]
	)

	const tokenomicsCards = [
		{
			title: 'Market Cap vs. FDV (Ratio)',
			value: '3:1',
			score: 7.8
		},
		{
			title: 'Fully Diluted Valuation (FDV)(USD)',
			value: usd(row.fdvUsd ?? 999_999_999),
			score: 7.8
		},
		{
			title: 'Annualized Rate of Inflation',
			value: pct(1.5),
			score: 7.8
		},
		{
			title: 'Buyback & Burn Events',
			value: '3',
			score: 7.8
		}
	]

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-3">
					<TokenLogo src={null} size={32} />
					<h1 className="heading-sm">
						{row.name} <span className="text-tertiary">{row.symbol}</span>
					</h1>
					<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
						{row.claimed ? (
							<span className="flex h-8 items-center gap-1 rounded-full border border-brand/30 bg-brand-muted px-3 label-sm text-link">
								Verified
							</span>
						) : null}
						<SecondaryBadge className="h-8 px-3">Status: {LISTING_STATUS_LABELS[row.listingStatus]}</SecondaryBadge>
					</div>
				</div>
				<div className="flex items-center gap-2 max-lg:w-full">
					<Button type="button" size="md" className="justify-center max-lg:flex-1">
						About {row.symbol}
						<Icon name="circle-help" height={14} width={14} />
					</Button>
					<Button type="button" size="md" className="justify-center max-lg:flex-1">
						Share
						<Icon name="share" height={14} width={14} />
					</Button>
				</div>
			</div>

			<Panel padding="none">
				<div className="flex flex-col divide-y divide-(--border-subtle) md:flex-row md:divide-x md:divide-y-0">
					<div className="flex items-center gap-3 px-4 py-3">
						<GradeChip score={row.scores.overall} />
						<div className="flex flex-col">
							<span className="label-md">
								Overall Score:{' '}
								<span className="font-jetbrains tabular-nums">{row.scores.overall?.toFixed(1) ?? 'N/A'}</span>
								<span className="text-tertiary"> /100</span>
							</span>
							{row.scores.rank != null ? (
								<span className="body-sm text-secondary">Rank: {row.scores.rank} of 1,300</span>
							) : null}
						</div>
					</div>
					<TickScoreStrip label="Disclosures" score={disclosureScore} />
					<TickScoreStrip label="Performance" score={performanceScore} />
				</div>
			</Panel>

			{!row.claimed ? <ClaimProfileBanner /> : null}

			<h2 className="heading-sm">Disclosures Overview</h2>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{disclosureSections.map((section) => (
					<DisclosureCard
						key={section.title}
						title={section.title}
						items={section.items}
						onOpen={(item) => setDrawer({ kind: 'disclosure', section: section.title, item })}
					/>
				))}
			</div>

			{isListed ? (
				<>
					<h2 className="heading-sm">Performance Overview: Market Quality</h2>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{marketQualityCards.map((card) => (
							<MetricCard
								key={card.title}
								title={card.title}
								score={card.score}
								percentile={card.score == null ? null : 85.28}
								onOpen={() =>
									setDrawer({
										kind: 'metric',
										title: card.title,
										score: card.score,
										chart: card.chart,
										seed: card.seed
									})
								}
							>
								<SimpleChart
									option={
										card.chart === 'candles'
											? buildCandleOption(getMockCandles(card.seed), axisColor)
											: buildSeriesOption(card.series as SimpleSeries[], axisColor)
									}
								/>
								<KvTable rows={card.rows} />
							</MetricCard>
						))}
					</div>

					<h2 className="heading-sm">Performance Overview: Liquidity Providers</h2>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<LpPerformanceInsights mmDepthPct={50} mmVolumePct={25} avgSpreadPct={1.5} />
						<LpPerformanceSummary />
					</div>
					<LpPerformanceBreakdown />
					<LpUptimeCalculations />
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
						{[
							{
								title: 'Market Maker Volume (as a % of total volume)',
								score: row.claimed ? 8.5 : null
							},
							{
								title: 'Market Maker Depth (as a % of total depth)',
								score: row.claimed ? 8.5 : null
							},
							{
								title: 'Market Maker Uptime / KPI Adherence',
								score: row.claimed ? 8.5 : null
							}
						].map((card) => (
							<Panel key={card.title} padding="none">
								<div className="flex items-center justify-between gap-2 px-4 py-3">
									<h3 className="label-md">{card.title}</h3>
									<Button
										type="button"
										size="sm"
										square
										aria-label={`Open ${card.title} details`}
										onClick={() =>
											setDrawer({
												kind: 'metric',
												title: card.title,
												score: card.score,
												chart: 'series',
												seed: seedFor(row.asset, 111)
											})
										}
									>
										<Icon name="arrow-right" height={14} width={14} />
									</Button>
								</div>
								{card.score == null ? <p className="px-4 pb-2 body-sm text-tertiary">N/A</p> : null}
								<GradeFooterColumns score={card.score} percentile={card.score == null ? null : 85.28} />
							</Panel>
						))}
					</div>

					<h2 className="heading-sm">Performance Overview: Liquidity Footprint</h2>
					<Panel padding="none">
						<div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
							<h3 className="label-lg">Top-Tier Exchange Coverage</h3>
						</div>
						<div className="flex flex-col divide-y divide-(--border-subtle) md:flex-row md:items-stretch md:divide-x md:divide-y-0">
							<div className="flex flex-1 flex-wrap items-center gap-2 px-4 py-2.5">
								<span className="label-lg">
									{tier1Covered.length} out of {TIER1_EXCHANGES.length} (
									{Math.round((tier1Covered.length / TIER1_EXCHANGES.length) * 100)}
									%)
								</span>
								{TIER1_EXCHANGES.map((exchange) => {
									const covered = tier1Covered.includes(exchange)
									return (
										<StatusBadge
											key={exchange}
											status={covered ? 'full' : 'not-listed'}
											className="gap-1.5 px-2.5 py-1"
											label={
												<>
													<span className={covered ? 'flex' : 'flex opacity-50 grayscale'}>
														<TokenLogo name={exchange.toLowerCase()} kind="exchange" size={14} />
													</span>
													{exchange}
													{covered ? <Icon name="check-circle" height={12} width={12} /> : null}
												</>
											}
										/>
									)
								})}
							</div>
							<div className="md:flex md:w-1/2 md:shrink-0 md:flex-col md:justify-center">
								<GradeFooter score={8.5} percentile={85.28} divider={false} />
							</div>
						</div>
					</Panel>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{footprintCards.map((card) => (
							<MetricCard
								key={card.title}
								title={card.title}
								score={card.score}
								percentile={card.score == null ? null : 85.28}
								onOpen={() =>
									setDrawer({
										kind: 'metric',
										title: card.title,
										score: card.score,
										chart: 'series',
										seed: card.seed
									})
								}
							>
								<SimpleChart
									option={buildSeriesOption(
										[
											{
												name: card.names[0],
												type: 'bar',
												color: card.colors[0],
												stack: 'total',
												data: getMockSeries(card.seed, 30, 40_000_000, 0.3)
											},
											{
												name: card.names[1],
												type: 'bar',
												color: card.colors[1],
												stack: 'total',
												data: getMockSeries(card.seed + 1, 30, 25_000_000, 0.3)
											}
										],
										axisColor
									)}
								/>
								<KvTable
									rows={[
										[card.names[0], `$${formatNumber(85_248_245)}`],
										[card.names[1], `$${formatNumber(150_890_567)}`],
										[`${card.names[0]} / ${card.names[1]}`, '36.06%']
									]}
								/>
							</MetricCard>
						))}
					</div>

					<h2 className="heading-sm">Performance Overview: Tokenomics</h2>
					<Panel padding="none">
						<div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
							<h3 className="label-lg">Disclosed Token Vesting vs Actual Vesting</h3>
							<Button
								type="button"
								size="sm"
								square
								aria-label="Open vesting details"
								onClick={() =>
									setDrawer({
										kind: 'metric',
										title: 'Disclosed Token Vesting vs Actual Vesting',
										score: 8.5,
										chart: 'series',
										seed: seedFor(row.asset, 121)
									})
								}
							>
								<Icon name="arrow-right" height={14} width={14} />
							</Button>
						</div>
						<div className="grid grid-cols-2 gap-px border-b border-subtle md:grid-cols-4">
							{(
								[
									['Disclosed TGE Date', 'Jan 16, 2027'],
									['Disclosed Duration', '36 months'],
									['Disclosed Total Groups', '8'],
									['Disclosed Max. Supply', `1.00B ${row.symbol}`]
								] as [string, string][]
							).map(([label, value]) => (
								<div key={label} className="flex flex-col gap-0.5 px-4 py-3">
									<span className="body-sm text-tertiary">{label}</span>
									<span className="label-md">{value}</span>
								</div>
							))}
						</div>
						<div className="p-4">
							<SimpleChart
								option={buildSeriesOption(
									[
										'Staking Rewards',
										'DAO Treasury',
										'Liquidity Mining Rewards',
										'Core Contributors',
										'Seed Investors'
									].map((name, index) => ({
										name,
										type: 'bar',
										stack: 'vesting',
										color: ['#c0a03a', '#11935f', '#7c3aed', '#2172E5', '#b23a38'][index],
										data: getMockSeries(seedFor(row.asset, 131 + index), 36, 4_000_000 * (index + 1), 0.05).map(
											([time, value], month) => [time, Math.round((value * (month + 1)) / 36)]
										)
									})),
									axisColor
								)}
								className="h-[240px] w-full"
							/>
						</div>
						<GradeFooter score={8.5} percentile={85.28} />
					</Panel>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
						{tokenomicsCards.map((card) => (
							<Panel key={card.title} padding="none">
								<div className="flex items-center justify-between gap-2 px-4 py-3">
									<div className="flex flex-col gap-0.5">
										<h3 className="body-sm text-secondary">{card.title}</h3>
										<span className="label-lg">{card.value}</span>
									</div>
									<Button
										type="button"
										size="sm"
										square
										aria-label={`Open ${card.title} details`}
										onClick={() =>
											setDrawer({
												kind: 'metric',
												title: card.title,
												score: card.score,
												chart: 'series',
												seed: seedFor(row.asset, 141)
											})
										}
									>
										<Icon name="arrow-right" height={14} width={14} />
									</Button>
								</div>
								<GradeFooterStacked score={card.score} percentile={card.score == null ? null : 85.28} />
							</Panel>
						))}
					</div>
				</>
			) : (
				<PreTgePerformance />
			)}

			<TokenDrawer state={drawer} onClose={() => setDrawer(null)} />
		</div>
	)
}
