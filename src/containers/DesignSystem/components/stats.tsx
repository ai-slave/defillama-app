import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { DividedGrid } from '~/ui/DividedGrid'
import { HeroMetric } from '~/ui/HeroMetric'
import { Icon } from '~/ui/Icon'
import { KeyMetricsPanel } from '~/ui/KeyMetricsCard'
import { MetricRow, MetricSection, SubMetricRow, SubMetricSection } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { Skeleton } from '~/ui/Skeleton'
import { SmolStatCard } from '~/ui/SmolStatCard'
import {
	InlineStatStrip,
	StatItem,
	StatTile,
	SummaryCardGrid,
	SummaryChange,
	SummaryStatsCard
} from '~/ui/SummaryStats'
import { Example, FAILED_READ, type Family } from '../shared'

const BY_CHAIN: Array<[string, string]> = [
	['Ethereum', '$3.12b'],
	['Solana', '$812.4m'],
	['Arbitrum', '$402.9m'],
	['Base', '$318.0m']
]

// The .csv and .png footer buttons; the real ones are CSVDownloadButton and ChartPngExportButton.
const FOOTER_CSV = (
	<Button size="sm">
		<Icon name="download-paper" className="size-3.5" aria-hidden />
		<span>.csv</span>
	</Button>
)

const FOOTER = (
	<>
		{FOOTER_CSV}
		<Button size="sm">
			<Icon name="download-paper" className="size-3.5" aria-hidden />
			<span>.png</span>
		</Button>
	</>
)

const SPARK = <Skeleton still className="h-10 w-full" />

const KEY_METRIC_ROWS = (
	<>
		<MetricRow label="Fees (24h)" value="$1.06m" />
		<MetricRow label="Revenue (24h)" value="$212.4k" />
	</>
)

const CHANGE_UNITS = { percent: 2.2, usd: 108_400_000, count: 1240, pp: 0.12 }
const SIGN = { up: 1, down: -1, zero: 0 }
type ChangeUnit = keyof typeof CHANGE_UNITS

// A signed value for a unit and direction knob, so the demos read as a real movement in each unit.
const signedChange = (unit: ChangeUnit, direction: string) => CHANGE_UNITS[unit] * SIGN[direction as keyof typeof SIGN]

const CELLS: Array<[string, string]> = [
	['Open', '$1.04'],
	['High', '$1.08'],
	['Low', '$0.99'],
	['Close', '$1.06'],
	['Volume', '$12.4m'],
	['Trades', '8,204']
]

export const stats: Family = {
	id: 'stats',
	title: 'Numbers and stats',
	parts: [
		{
			name: 'DividedGrid',
			source: 'src/ui/DividedGrid.tsx',
			knobs: [{ name: 'cells', values: ['4', '3', '6'], default: '4', prop: false }],
			note: 'Inside a Card that draws the outer border; four cells in three columns leave a short last row.',
			render: (values) => (
				<div className="w-full max-w-lg">
					<Card padding="none">
						<DividedGrid columns="grid-cols-1 sm:grid-cols-3">
							{CELLS.slice(0, Number(values.cells)).map(([label, value]) => (
								<StatItem key={label} className="p-3" label={label} value={value} />
							))}
						</DividedGrid>
					</Card>
				</div>
			)
		},
		{
			name: 'HeroMetric',
			source: 'src/ui/HeroMetric.tsx',
			knobs: [{ name: 'byChain', boolean: true, prop: false }],
			render: (values) => (
				<div className="w-72">
					<HeroMetric
						label="Total Value Locked"
						tooltip="Value of assets deposited in the protocol."
						value="$4.82b"
						byChain={values.byChain ? BY_CHAIN : undefined}
						byChainTitle="TVL by chain"
						headingAs="h4"
					/>
				</div>
			)
		},
		{
			name: 'SummaryStatsCard',
			source: 'src/ui/SummaryStats.tsx',
			knobs: [
				{ name: 'padding', values: ['md', 'sm'], default: 'md' },
				{ name: 'gap', values: ['md', 'sm'], default: 'md' }
			],
			render: (values) => (
				<div className="w-80">
					<SummaryStatsCard padding={values.padding as 'md' | 'sm'} gap={values.gap as 'md' | 'sm'}>
						<StatItem label="Stablecoins market cap" value="$231.4b" />
						<div className="flex flex-col">
							<MetricRow label="USDT" value="$118.2b" />
							<MetricRow label="USDC" value="$61.9b" />
						</div>
					</SummaryStatsCard>
				</div>
			),
			states: () => (
				<Example
					wide
					name="Beside the chart"
					note="Inside SummaryCardGrid, with KeyMetricsPanel and its footer exports."
				>
					<SummaryCardGrid>
						<SummaryStatsCard>
							<div className="flex flex-wrap items-end justify-between gap-2">
								<StatItem
									label="Total Value Locked"
									value="$4.82b"
									tooltip="Value of assets deposited in the protocol."
								/>
								<SummaryChange value={-2.2} comparison="over 24h" />
							</div>
							<KeyMetricsPanel footer={FOOTER} headingAs="h4">
								{KEY_METRIC_ROWS}
							</KeyMetricsPanel>
						</SummaryStatsCard>
						<Panel className="col-span-2 min-h-[240px] items-center justify-center">
							<p className="body-sm text-tertiary">The page&rsquo;s main chart</p>
						</Panel>
					</SummaryCardGrid>
				</Example>
			)
		},
		{
			name: 'SummaryChange',
			source: 'src/ui/SummaryStats.tsx',
			knobs: [
				{ name: 'unit', values: ['percent', 'usd', 'count', 'pp'], default: 'percent' },
				{ name: 'direction', values: ['down', 'up'], default: 'down', prop: false },
				{ name: 'tooltip', boolean: true, prop: false }
			],
			note: 'Beside its StatItem.',
			render: (values) => {
				const unit = values.unit as ChangeUnit
				return (
					<div className="flex w-72 flex-wrap items-end justify-between gap-2">
						<StatItem label="Total Value Locked" value="$4.82b" />
						<SummaryChange
							value={signedChange(unit, values.direction as string)}
							unit={unit}
							comparison="over 24h"
							tooltip={values.tooltip ? '-$108.4m' : undefined}
						/>
					</div>
				)
			}
		},
		{
			name: 'KeyMetricsPanel',
			source: 'src/ui/KeyMetricsCard.tsx',
			knobs: [
				{ name: 'id', boolean: true, prop: false },
				{ name: 'footer', values: ['two', 'one', 'none'], default: 'two', prop: false }
			],
			note: 'Switch id on, then hover or focus the heading to see its self link. Without a footer nothing is reserved.',
			render: (values) => (
				<div className="w-80">
					<Card padding="md" className="flex" data-anatomy='Card padding="md"'>
						<div className="contents" data-anatomy="KeyMetricsPanel">
							<KeyMetricsPanel
								id={values.id ? 'key-metrics-demo' : undefined}
								footer={values.footer === 'two' ? FOOTER : values.footer === 'one' ? FOOTER_CSV : undefined}
								headingAs="h4"
							>
								{KEY_METRIC_ROWS}
							</KeyMetricsPanel>
						</div>
					</Card>
				</div>
			),
			anatomy: true
		},
		{
			name: 'MetricRow',
			source: 'src/ui/MetricPrimitives.tsx',
			knobs: [
				{ name: 'tooltip', boolean: true, prop: false },
				{ name: 'extra', boolean: true, prop: false },
				{ name: 'dashed', boolean: true }
			],
			render: (values) => (
				<div className="flex w-80 flex-col">
					<MetricRow
						label="Revenue (24h)"
						tooltip={values.tooltip ? 'Fees kept by the protocol after supply-side payouts.' : undefined}
						extra={values.extra ? <span className="body-sm text-tertiary">30d</span> : undefined}
						dashed={values.dashed === true}
						value="$212.4k"
					/>
				</div>
			),
			states: () => (
				<Example name="Sub rows" prop="SubMetricRow" note="Indented rows under a section.">
					<div className="flex w-80 flex-col">
						<SubMetricRow label="Stablecoins" value="$11.2m" />
						<SubMetricRow label="Native token" tooltip="Held in the protocol's own token." value="$7.4m" />
					</div>
				</Example>
			)
		},
		{
			name: 'MetricSection',
			source: 'src/ui/MetricPrimitives.tsx',
			knobs: [{ name: 'defaultOpen', boolean: true }],
			note: 'The open section nests a SubMetricSection.',
			// defaultOpen only sets the first state, so the key remounts the section when the knob flips.
			render: (values) => (
				<div className="flex w-80 flex-col">
					<MetricSection
						key={String(values.defaultOpen)}
						label="Supplied"
						tooltip="Assets lent into the protocol."
						value="$3.4b"
						defaultOpen={values.defaultOpen === true}
					>
						<SubMetricRow label="Ethereum" value="$2.0b" />
						<SubMetricSection label="Layer 2s" value="$1.4b">
							<SubMetricRow label="Arbitrum" value="$900.0m" />
							<SubMetricRow label="Base" value="$500.0m" />
						</SubMetricSection>
					</MetricSection>
				</div>
			)
		},
		{
			name: 'InlineStatStrip',
			source: 'src/ui/SummaryStats.tsx',
			knobs: [
				{ name: 'stacked', boolean: true },
				{ name: 'changes', boolean: true, prop: false }
			],
			render: (values) => (
				<div className="w-full max-w-3xl">
					<InlineStatStrip
						stacked={values.stacked === true}
						items={[
							{
								label: 'Market cap',
								value: '$2.41t',
								change: values.changes ? { value: 1.84, comparison: 'over 24h' } : undefined
							},
							{
								label: 'Volume (24h)',
								value: '$96.2b',
								change: values.changes ? { value: -4_120_000_000, unit: 'usd', comparison: 'vs 24h ago' } : undefined
							},
							{
								label: 'Tokens',
								value: '12,418',
								change: values.changes ? { value: 0, unit: 'count', comparison: 'over 7d' } : undefined
							}
						]}
					/>
				</div>
			),
			states: () => (
				<Example
					wide
					name="Hidden label and definition"
					prop="labelHidden / tooltip"
					note="One label is kept for screen readers only; one carries a definition."
				>
					<div className="max-w-3xl">
						<InlineStatStrip
							stacked
							items={[
								{ label: 'Market cap', value: '$2.41t', tooltip: 'Circulating supply times price.' },
								{ label: 'Venue', value: 'Binance', labelHidden: true },
								{ label: 'Pairs', value: '1,204' }
							]}
						/>
					</div>
				</Example>
			)
		},
		{
			name: 'SmolStatCard',
			source: 'src/ui/SmolStatCard.tsx',
			knobs: [
				{ name: 'layout', values: ['stack', 'split'], default: 'stack' },
				{ name: 'state', values: ['rest', 'unavailable', 'loading', 'failed'], default: 'rest', prop: false },
				{ name: 'change', boolean: true, prop: false }
			],
			note: 'The split chart sits beside the text from xl and the mark drops there.',
			render: (values) => {
				const split = values.layout === 'split'
				const rest = values.state === 'rest'
				return (
					<div className={split ? 'w-full max-w-xl' : 'w-60'}>
						<SmolStatCard
							layout={split ? 'split' : 'stack'}
							title="Fees"
							tooltip="Fees paid by users."
							value={rest ? '$1.06m' : null}
							qualifier={rest ? '24h' : undefined}
							change={values.change ? { value: 3.2, comparison: 'vs 24h ago' } : undefined}
							isLoading={values.state === 'loading'}
							failedRead={values.state === 'failed' ? FAILED_READ : undefined}
							className={split ? undefined : 'h-[132px]'}
						>
							{SPARK}
						</SmolStatCard>
					</div>
				)
			}
		},
		{
			name: 'StatTile',
			source: 'src/ui/SummaryStats.tsx',
			knobs: [
				{ name: 'state', values: ['rest', 'loading'], default: 'rest', prop: false },
				{ name: 'sub', boolean: true, prop: false },
				{ name: 'change', boolean: true, prop: false },
				{ name: 'tooltip', boolean: true, prop: false }
			],
			note: 'One tile of a two-column grid.',
			render: (values) => {
				const shared = {
					label: 'Fees (24h)',
					tooltip: values.tooltip ? 'Fees paid by users.' : undefined,
					sub: values.sub ? 'Across 14 chains' : undefined,
					change: values.change ? { value: 3.2, comparison: 'vs 24h ago', tooltip: '+$32.9k' } : undefined
				}
				return (
					<div className="w-56">
						{values.state === 'loading' ? <StatTile {...shared} loading /> : <StatTile {...shared} value="$1.06m" />}
					</div>
				)
			}
		},
		{
			name: 'Change',
			source: 'src/ui/Change.tsx',
			knobs: [
				{ name: 'unit', values: ['percent', 'usd', 'count', 'pp'], default: 'percent' },
				{ name: 'direction', values: ['up', 'down', 'zero'], default: 'up', prop: false },
				{ name: 'tooltip', boolean: true, prop: false }
			],
			note: 'Zero takes the color of its container.',
			render: (values) => {
				const unit = values.unit as ChangeUnit
				return (
					<Change
						value={signedChange(unit, values.direction as string)}
						unit={unit}
						tooltip={values.tooltip ? '+$2.1b' : undefined}
					/>
				)
			}
		}
	]
}
