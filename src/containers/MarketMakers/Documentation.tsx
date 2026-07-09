import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Icon } from '~/components/Icon'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { docsAsset, FigureDualTable, FigureRadar, FigureTable } from './DocsFigures'
import { MarketMakersOutro } from './MarketMakersOutro'
import { MarketMakersTabs } from './MarketMakersTabs'

const LAST_UPDATED = 'April 8th, 2026'

const TOC_ITEMS = [
	{ id: 'introduction', label: 'Introduction' },
	{ id: 'preface', label: '1. Preface & Overview' },
	{ id: 'performance-index', label: '2. Performance Index' },
	{ id: 'depth-leaderboard', label: '3. Depth Leaderboard' },
	{ id: 'volume-leaderboard', label: '4. Volume Leaderboard' },
	{ id: 'spread-leaderboard', label: '5. Spread Leaderboard' },
	{ id: 'kpi-adherence-leaderboard', label: '6. KPI Adherence Leaderboard' },
	{ id: 'glossary', label: '7. Glossary' }
] as const

type WeightRow = { metric: string; weighting: string; ranking?: number }

const PERFORMANCE_GLOBAL_WEIGHTS: WeightRow[] = [
	{ metric: 'Trading KPIs', weighting: '40%' },
	{ metric: 'Trust & Integration', weighting: '20%' },
	{ metric: 'Coverage & Capabilities', weighting: '15%' },
	{ metric: 'Uptime', weighting: '10%' },
	{ metric: 'Integration Level', weighting: '15%' }
]

const PERFORMANCE_KPI_WEIGHTS: WeightRow[] = [
	{ metric: 'Bid Depth 100 bps, USD Value', weighting: '12.50%', ranking: 1 },
	{ metric: 'Maker Fill Volume, USD Value', weighting: '10.25%', ranking: 2 },
	{ metric: 'Combine Uptime %', weighting: '10.00%', ranking: 3 },
	{ metric: 'Uptime %, Bid & Ask Depth 200 bps', weighting: '8.00%', ranking: 4 },
	{ metric: 'Bid & Ask Spread (%)', weighting: '7.00%', ranking: 5 },
	{ metric: 'Bid Depth 200 bps, USD Value', weighting: '5.00%', ranking: 6 },
	{ metric: 'Bid Depth 200 bps, % of Market', weighting: '5.00%', ranking: 7 },
	{ metric: 'Maker Fill Volume, % of Market', weighting: '5.00%', ranking: 8 },
	{ metric: 'Number of Projects', weighting: '5.00%', ranking: 9 },
	{ metric: 'Uptime %, Bid & Ask Depth 100 bps', weighting: '4.00%', ranking: 10 },
	{ metric: 'Bid Depth 50 bps, USD Value', weighting: '2.50%', ranking: 11 },
	{ metric: 'Ask Depth 100 bps, USD Value', weighting: '2.50%', ranking: 12 },
	{ metric: 'Bid Depth 100 bps, USD Value', weighting: '2.50%', ranking: 13 },
	{ metric: 'Loan Utilization, Maker Fill Volume', weighting: '2.50%', ranking: 14 },
	{ metric: 'Uptime %, Bid-Ask Spread', weighting: '2.50%', ranking: 15 },
	{ metric: 'Uptime %, Bid & Ask Depth 50 bps', weighting: '2.00%', ranking: 16 },
	{ metric: 'Ask Depth 200 bps, USD Value', weighting: '2.00%', ranking: 17 },
	{ metric: 'Ask Depth 200 bps, % of Market', weighting: '2.00%', ranking: 18 },
	{ metric: 'Loan Utilization, Bid & Ask Depth 200 bps', weighting: '2.00%', ranking: 19 },
	{ metric: 'Taker Fill Volume, USD Value', weighting: '1.50%', ranking: 20 },
	{ metric: 'Bid Depth 50 bps, % of Market', weighting: '1.25%', ranking: 21 },
	{ metric: 'Bid Depth 100 bps, % of Market', weighting: '1.00%', ranking: 22 },
	{ metric: 'Loan Utilization, Bid & Ask Depth 100 bps', weighting: '1.00%', ranking: 23 },
	{ metric: 'Taker Fill Volume, % of Market', weighting: '1.00%', ranking: 24 },
	{ metric: 'Ask Depth 50 bps, USD Value', weighting: '0.05%', ranking: 25 },
	{ metric: 'Ask Depth 50 bps, % of Market', weighting: '0.05%', ranking: 26 },
	{ metric: 'Loan Utilization, Bid & Ask Depth 50 bps', weighting: '0.05%', ranking: 27 },
	{ metric: 'Loan Utilization, Taker Fill Volume', weighting: '0.05%', ranking: 28 }
]

const DEPTH_WEIGHTS: WeightRow[] = [
	{ metric: 'Bid Depth 200 bps, USD Value', weighting: '15.00%', ranking: 1 },
	{ metric: 'Number of Projects', weighting: '10.00%', ranking: 2 },
	{ metric: 'Bid Depth 200 bps, % of Market', weighting: '9.25%', ranking: 3 },
	{ metric: 'Ask Depth 200 bps, USD Value', weighting: '8.00%', ranking: 4 },
	{ metric: 'Uptime %, Bid & Ask Depth 200 bps', weighting: '8.00%', ranking: 5 },
	{ metric: 'Loan Utilization, Bid & Ask Depth 200 bps', weighting: '8.00%', ranking: 6 },
	{ metric: 'Bid Depth 100 bps, USD Value', weighting: '6.00%', ranking: 7 },
	{ metric: 'Bid Depth 100 bps, % of Market', weighting: '5.00%', ranking: 8 },
	{ metric: 'Ask Depth 200 bps, % of Market', weighting: '5.00%', ranking: 9 },
	{ metric: 'Uptime %, Bid & Ask Depth 100 bps', weighting: '4.00%', ranking: 10 },
	{ metric: 'Loan Utilization, Bid & Ask Depth 100 bps', weighting: '4.00%', ranking: 11 },
	{ metric: 'Ask Depth 100 bps, USD Value', weighting: '3.00%', ranking: 12 },
	{ metric: 'Bid Depth 50 bps, USD Value', weighting: '3.00%', ranking: 13 },
	{ metric: 'Ask Depth 100 bps, % of Market', weighting: '2.50%', ranking: 14 },
	{ metric: 'Bid Depth 50 bps, % of Market', weighting: '2.50%', ranking: 15 },
	{ metric: 'Uptime %, Bid & Ask Depth 50 bps', weighting: '2.00%', ranking: 16 },
	{ metric: 'Loan Utilization, Bid & Ask Depth 50 bps', weighting: '2.00%', ranking: 17 },
	{ metric: 'Ask Depth 50 bps, USD Value', weighting: '1.50%', ranking: 18 },
	{ metric: 'Ask Depth 50 bps, % of Market', weighting: '1.25%', ranking: 19 }
]

const VOLUME_WEIGHTS: WeightRow[] = [
	{ metric: 'Maker Fill Volume, USD Value', weighting: '35.00%', ranking: 1 },
	{ metric: 'Maker Fill Volume, % of Market', weighting: '25.00%', ranking: 2 },
	{ metric: 'Taker Fill Volume, USD Value', weighting: '10.00%', ranking: 3 },
	{ metric: 'Loan Utilization, Maker Fill Volume', weighting: '10.00%', ranking: 4 },
	{ metric: 'Number of Projects', weighting: '10.00%', ranking: 5 },
	{ metric: 'Taker Fill Volume, % of Market', weighting: '5.00%', ranking: 6 },
	{ metric: 'Loan Utilization, Taker Fill Volume', weighting: '2.50%', ranking: 7 },
	{ metric: 'Volume Loan Utilization', weighting: '2.50%', ranking: 8 }
]

const SPREAD_WEIGHTS: WeightRow[] = [
	{ metric: 'Volume-Weighted Bid-Ask Spread', weighting: '50.00%', ranking: 1 },
	{ metric: 'Spread Uptime', weighting: '40.00%', ranking: 2 },
	{ metric: 'Number of Projects', weighting: '10.00%', ranking: 3 }
]

const KPI_WEIGHTS: WeightRow[] = [
	{ metric: 'Depth 200 bps, Uptime %', weighting: '35.00%', ranking: 1 },
	{ metric: 'Depth 100 bps, Uptime %', weighting: '20.00%', ranking: 2 },
	{ metric: 'Volume-Weighted Bid-Ask Spread, Uptime %', weighting: '20.00%', ranking: 3 },
	{ metric: 'Depth 50 bps, Uptime %', weighting: '15.00%', ranking: 4 },
	{ metric: 'Projects Count', weighting: '10.00%', ranking: 5 }
]

type GlossaryEntry = { term: string; def: string; bullets?: string[]; code?: string }

const GLOSSARY: GlossaryEntry[] = [
	{
		term: '% of Market',
		def: "A market maker's relative contribution to total depth or volume within a defined set of engagements or thresholds. Take the following example:",
		bullets: ['Total Market Volume: $50M', 'Market Maker Volume: $5M', '% of Market (Market Share) = 10%']
	},
	{
		term: '+/- 0.50%, +/- 1.00%, & +/- 2.00%',
		def: 'Depth of liquidity thresholds measured from the midpoint between the best-bid and best-ask.'
	},
	{
		term: 'Active Engagements',
		def: 'Live market making mandates currently being tracked by Forgd across token projects.'
	},
	{ term: 'Aggregate Depth', def: 'The total resting bid and ask liquidity within a defined percentage threshold.' },
	{
		term: 'Ancillary Trading Functions',
		def: 'Trading activities outside of core market making, including strategies or services that support liquidity, execution, or capital deployment.'
	},
	{
		term: 'Ask-Side Liquidity',
		def: 'Resting sell orders placed above the mid-point that contribute to the offer side of the order book.'
	},
	{
		term: 'Best Ask',
		def: 'The lowest price at which a market maker is willing to sell an asset, as a resting limit order.'
	},
	{
		term: 'Best Bid',
		def: 'The highest price at which a market maker is willing to buy an asset, as a resting limit order.'
	},
	{
		term: 'Bid-Ask Spread',
		def: 'The difference between the best bid and best ask, typically expressed as a percentage relative to the midpoint price.'
	},
	{
		term: 'Bid-Side Liquidity',
		def: 'Resting buy orders placed below the mid-point that contribute to the bid side of the order book.'
	},
	{ term: 'Binary Outcome', def: 'A pass/fail result used to evaluate whether a KPI was met on a given day.' },
	{
		term: 'Capital Efficiency',
		def: 'How effectively a market maker deploys inventory to provide liquidity and participate in trades.'
	},
	{
		term: 'Centralized Exchange ("CEX")',
		def: 'A centralized trading venue where assets are traded through an order book managed by an operator.'
	},
	{
		term: 'Combined Uptime',
		def: 'The percentage of time a market maker simultaneously meets multiple KPI thresholds across depth and spreads.'
	},
	{
		term: 'Composite Score',
		def: 'The weighted output of 50+ KPIs and attributes used to rank market makers in the Performance Index.'
	},
	{
		term: 'Coverage & Capabilities',
		def: "A measure of a market maker's presence across CEXs, DEXs, and additional trading functions beyond core market making."
	},
	{
		term: 'Depth',
		def: 'The amount of resting bid and ask liquidity available within a defined range around the mid-point.'
	},
	{
		term: 'Depth Loan Utilization',
		def: 'The ratio of loaned inventory used to support quoted depth relative to total average depth provided. Take the following example:',
		bullets: ['Loaned Inventory: $1M', 'Average Daily Depth (+/- 2.00%): $250K', 'Depth Loan Utilization = 25%']
	},
	{
		term: 'Decentralized Exchange ("DEX")',
		def: 'An on-chain trading venue where assets are traded without a centralized intermediary.'
	},
	{
		term: 'Executed Volume',
		def: 'Total trading activity attributed to a market maker, including both maker and taker fills.'
	},
	{
		term: 'Execution Quality',
		def: 'A measure of how effectively a market maker facilitates trades, typically reflected through volume, spreads, and consistency.'
	},
	{
		term: 'Implied Transaction Costs',
		def: 'The effective cost of trading derived from the bid-ask spread and available liquidity.'
	},
	{
		term: 'Integration Level',
		def: "The degree to which a market maker is integrated with Forgd's data infrastructure and reporting systems."
	},
	{
		term: 'Integrations',
		def: 'The number of direct connections a market maker maintains with exchanges, trading venues, or systems used for execution and data flow.'
	},
	{
		term: 'Inventory',
		def: 'The assets held by a market maker that are used to provide liquidity and facilitate trading.'
	},
	{
		term: 'Key Performance Indicator ("KPI")',
		def: "A predefined metric used to evaluate a market maker's performance across depth, spreads, volume, or uptime."
	},
	{
		term: 'KPI Adherence',
		def: 'The proportion of time a market maker meets predefined KPI thresholds, measured using a daily pass/fail framework. Take the following example:',
		bullets: [
			'Evaluation Period: 30 days',
			'Days KPI Thresholds Met: 27',
			'Days KPI Thresholds Not Met: 3',
			'KPI Adherence = 27 / 30 = 90%'
		]
	},
	{
		term: 'Loaned Inventory',
		def: 'Assets provided by a project to a market maker to support liquidity provision and trading activity.'
	},
	{
		term: 'Maker Fill Volume',
		def: 'Executed volume where trades occur against resting liquidity provided by the market maker.'
	},
	{
		term: 'Market Maker Leaderboard',
		def: "Forgd's framework for ranking market makers across depth, volume, spreads, and KPI adherence using standardized metrics."
	},
	{ term: 'Market Turnover', def: 'The total amount of trading activity occurring over a given period.' },
	{
		term: 'Mid-Point',
		def: 'The price halfway between the best bid and best ask, used as the reference for measuring spreads and depth.'
	},
	{
		term: 'Normalized Metric',
		def: 'A metric expressed relative to a broader dataset, allowing for consistent comparison across market makers.'
	},
	{
		term: 'Notional Depth',
		def: 'The U.S. dollar value of resting bid and ask liquidity within a defined price threshold.'
	},
	{
		term: 'Order Book',
		def: 'The list of all resting bids and ask orders for a trading pair at a given point in time.'
	},
	{
		term: 'Passive Liquidity Provision',
		def: 'Providing resting orders on the order book that are filled by incoming market participants.'
	},
	{
		term: 'Percentile Ranking',
		def: 'A relative ranking that shows how a market maker compares to others as a percentage of the total distribution. Take the example below:',
		bullets: ['Total Market Makers: 50', 'Market Maker Rank: 10', 'Percentile Ranking = 80th percentile (top 20%)']
	},
	{
		term: 'Performance Index',
		def: "Forgd's composite ranking of market makers based on a weighted aggregation of 50+ performance and infrastructure metrics."
	},
	{
		term: 'Performance Thresholds',
		def: 'Predefined levels for depth, spreads, or other KPIs that market makers are expected to meet.'
	},
	{
		term: 'Project Count',
		def: 'The number of active engagements a market maker has across tracked token projects.'
	},
	{
		term: 'Quote Competitiveness',
		def: 'How closely a market maker quotes around the mid-point, typically reflected through spread tightness.'
	},
	{
		term: 'Ranking',
		def: 'The ordered position of a market maker relative to peers based on a specific metric or composite score.'
	},
	{
		term: 'Resting Liquidity',
		def: 'Open bid and ask orders sitting on the order book that have not yet been executed.'
	},
	{
		term: 'Spread Leaderboard',
		def: 'The leaderboard that ranks market makers based on volume-weighted bid-ask spreads across their tracked engagements.'
	},
	{
		term: 'Spread Uptime',
		def: 'The percentage of time a market maker maintains spreads within predefined thresholds.'
	},
	{
		term: 'Taker Fill Volume',
		def: 'Executed volume where the market maker actively crosses the spread to trade against existing liquidity.'
	},
	{ term: 'Top-of-Book', def: 'The best available bid and ask prices in the order book at a given point in time.' },
	{ term: 'Total Volume', def: 'The sum of maker and taker fill volume generated by a market maker.' },
	{
		term: 'Tracked Engagements',
		def: "Market making mandates where performance data is actively monitored and included in Forgd's datasets."
	},
	{
		term: 'Trading Pair',
		def: 'A pair of assets traded against each other, typically consisting of a base asset and a quote asset.'
	},
	{
		term: 'Trust & Integration',
		def: "A qualitative measure reflecting a market maker's system connectivity, data transparency, and integration with Forgd."
	},
	{ term: 'Uptime', def: 'The percentage of time a market maker meets predefined quoting or KPI thresholds.' },
	{ term: 'Venue', def: 'A trading platform, such as a CEX or DEX, where market activity occurs.' },
	{
		term: 'Volume Leaderboard',
		def: 'The leaderboard that ranks market makers based on executed trading activity across maker and taker volume.'
	},
	{
		term: 'Volume Loan Utilization',
		def: 'The ratio of average executed volume to loaned inventory, reflecting trading activity relative to available capital.',
		bullets: ['Loaned Inventory: $2M', 'Average Daily Trade Volume: $1M', 'Volume Loan Utilization: 50%']
	},
	{
		term: 'Volume-Weighted Bid-Ask Spread',
		def: 'The average bid-ask spread weighted by executed trading volume, giving greater influence to higher-activity periods.'
	},
	{
		term: 'Volume-Weighted Average Spread ("VWAS")',
		def: "The aggregated spread metric calculated by weighting each trading pair's spread by its share of total volume across venues. Take the following example where the MM is trading across 5 venues:",
		bullets: [
			'Venue 1: $1.0m @ 5 bps',
			'Venue 2: $750k @ 10 bps',
			'Venue 3: $500k @ 10 bps',
			'Venue 4: $100k @ 50 bps',
			'Venue 5: $10k @ 100 bps'
		],
		code: 'VWAS = [(1.0m×5) + (0.75m×10) + (0.5m×10) + (0.1m×50) + (0.01m×100)] / 2.36m ≈ 9.96 bps (~10 bps)'
	}
]

function useActiveSection(ids: readonly string[]) {
	const [active, setActive] = useState<string>(ids[0] ?? '')

	useEffect(() => {
		if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return
		const visible = new Set<string>()
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					const id = (e.target as HTMLElement).id
					if (e.isIntersecting) visible.add(id)
					else visible.delete(id)
				}
				const first = ids.find((id) => visible.has(id))
				if (first) setActive(first)
			},
			{ rootMargin: '-96px 0px -55% 0px', threshold: 0 }
		)
		for (const id of ids) {
			const el = document.getElementById(id)
			if (el) observer.observe(el)
		}
		return () => observer.disconnect()
	}, [ids])

	return active
}

function ShareButton() {
	const [copied, setCopied] = useState(false)
	const onShare = async () => {
		if (typeof navigator === 'undefined' || !navigator.clipboard) return
		try {
			await navigator.clipboard.writeText(window.location.href)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {}
	}
	return (
		<Button type="button" onClick={onShare} size="md">
			{copied ? 'Copied' : 'Share'}
			<Icon name={copied ? 'check-circle' : 'share'} className="size-3.5" />
		</Button>
	)
}

function TocList({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
	return (
		<nav aria-label="Table of contents" className="flex flex-col gap-0.5">
			{TOC_ITEMS.map((item) => {
				const isActive = active === item.id
				return (
					<a
						key={item.id}
						href={`#${item.id}`}
						onClick={onNavigate}
						aria-current={isActive ? 'true' : undefined}
						className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
							isActive
								? 'bg-hover-row font-medium text-primary'
								: 'text-secondary hover:bg-hover-row hover:text-primary'
						}`}
					>
						{item.label}
					</a>
				)
			})}
		</nav>
	)
}

function TocAccordion({ active }: { active: string }) {
	const [open, setOpen] = useState(false)
	const activeLabel = TOC_ITEMS.find((i) => i.id === active)?.label ?? 'Table of Contents'
	return (
		<Card padding="none" className="min-[1120px]:hidden">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left label-sm text-primary"
			>
				<span className="min-w-0 truncate">
					<span className="text-secondary">Contents: </span>
					{activeLabel}
				</span>
				<Icon
					name="chevron-down"
					className={`size-4 shrink-0 text-tertiary transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
				/>
			</button>
			<div
				className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
			>
				<div className="overflow-hidden">
					<div className="border-t border-subtle p-1">
						<TocList active={active} onNavigate={() => setOpen(false)} />
					</div>
				</div>
			</div>
		</Card>
	)
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
	return (
		<section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
			<h2 id={`${id}-title`} className="heading-sm text-primary">
				{title}
			</h2>
			<div className="mt-4 flex flex-col gap-4">{children}</div>
		</section>
	)
}

function SubHeading({ children }: { children: ReactNode }) {
	return <h3 className="mt-4 heading-xs text-primary">{children}</h3>
}

function Lead({ label, children }: { label: string; children: ReactNode }) {
	return (
		<p className="body-sm leading-relaxed text-secondary">
			<span className="font-semibold text-primary">{label}</span> {children}
		</p>
	)
}

function P({ children }: { children: ReactNode }) {
	return <p className="body-sm leading-relaxed text-secondary">{children}</p>
}

function Bullets({ items, ordered = false }: { items: ReactNode[]; ordered?: boolean }) {
	const cls = 'ml-5 flex flex-col gap-2 body-sm leading-relaxed text-secondary'
	const inner = items.map((item, i) => (
		<li key={i} className={ordered ? 'list-decimal' : 'list-disc'}>
			{item}
		</li>
	))
	return ordered ? <ol className={cls}>{inner}</ol> : <ul className={cls}>{inner}</ul>
}

function WeightTable({ rows, showRanking = true }: { rows: WeightRow[]; showRanking?: boolean }) {
	return (
		<div className="overflow-hidden rounded-[8px] border border-subtle">
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="bg-[#0b0f2e] text-white">
							<th className="px-4 py-3 text-center font-medium">Metric</th>
							<th className="w-40 px-4 py-3 text-center font-medium">Weighting</th>
							{showRanking ? <th className="w-28 px-4 py-3 text-center font-medium">Ranking</th> : null}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, i) => (
							<tr key={i} className="border-t border-subtle bg-surface first:border-t-0">
								<td className="px-4 py-2.5 text-primary">{row.metric}</td>
								<td className="px-4 py-2.5 text-center text-secondary tabular-nums">{row.weighting}</td>
								{showRanking ? (
									<td className="px-4 py-2.5 text-center text-secondary tabular-nums">{row.ranking}</td>
								) : null}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}

function Divider() {
	return <div role="separator" className="border-t border-subtle" />
}

function GlossaryItem({ entry }: { entry: GlossaryEntry }) {
	return (
		<div className="flex flex-col gap-2">
			<p className="body-sm leading-relaxed text-secondary">
				<span className="font-semibold text-primary">{entry.term}:</span> {entry.def}
			</p>
			{entry.bullets ? <Bullets items={entry.bullets} /> : null}
			{entry.code ? (
				<pre className="overflow-x-auto rounded-md bg-page p-3 text-xs text-primary">
					<code>{entry.code}</code>
				</pre>
			) : null}
		</div>
	)
}

export function MarketMakersDocumentation() {
	const ids = useMemo(() => TOC_ITEMS.map((i) => i.id), [])
	const active = useActiveSection(ids)

	return (
		<>
			<div className="flex flex-col gap-2">
				<MarketMakersTabs active="Documentation" />
				<Card padding="md">
					<div className="mb-4 flex items-center justify-between gap-3 border-b border-subtle pb-4 min-[1120px]:hidden">
						<span className="body-sm text-secondary">Last Updated: {LAST_UPDATED}</span>
						<ShareButton />
					</div>

					<div className="mb-4 min-[1120px]:hidden">
						<TocAccordion active={active} />
					</div>

					<div className="grid min-[1120px]:grid-cols-[minmax(0,1fr)_300px]">
						<div className="min-w-0 min-[1120px]:pr-8">
							<div className="mx-auto w-full max-w-[820px]">
								<div className="hidden h-9 items-center justify-between gap-3 min-[1120px]:flex">
									<span className="body-sm text-secondary">Last Updated: {LAST_UPDATED}</span>
									<ShareButton />
								</div>
								<div className="mt-3 hidden border-t border-subtle min-[1120px]:block" />
								<div className="flex w-full flex-col gap-10 min-[1120px]:pt-6">
									<h1 className="heading-sm text-primary">Market Maker Leaderboard Documentation</h1>

									<div id="introduction" aria-labelledby="introduction-title" className="scroll-mt-24">
										<span id="introduction-title" className="sr-only">
											Introduction
										</span>
										<Lead label="Required Context for Readers:">
											This document serves as the central repository for official documentation of Forgd's Market Maker
											Leaderboard. The content of this document is organized by the five pages of the Market Maker
											Leaderboard: Performance Index, Depth Leaderboard, Volume Leaderboard, Spread Leaderboard, and KPI
											Adherence Leaderboard in addition to a Preface section to provide a necessary overview of the
											aforementioned pages before readers dive in.
										</Lead>
									</div>

									<Divider />

									<Section id="preface" title="1. Preface & Market Maker Leaderboard Overview">
										<P>
											Forgd's Market Maker Leaderboard provides data-driven insights on{' '}
											<span className="font-semibold text-primary">40+ institutional liquidity providers</span> across
											key performance metrics to measure top-of-book spreads, depth of liquidity, fill order volume and
											KPI adherence. These metrics are calculated and updated on a daily basis across hundreds of
											engagements for live token projects that utilize Forgd to monitor Market Maker trade activity via
											our free-to-use dashboards. There are five distinct leaderboards: Performance Index, Depth
											Leaderboard, Volume Leaderboard, Spread Leaderboard, and KPI Adherence Leaderboard. A high level
											description of each can be found below:
										</P>
										<Bullets
											items={[
												<>
													<span className="font-semibold text-primary">The Performance Index</span> shows market maker
													ranks across all key performance metrics with additional information regarding their
													integration level with Forgd, their trading coverage & capabilities, and ancillary information
													(exchange coverage, non-market making services, active engagements shared with Forgd, and
													more). This allows Forgd to calculate a proprietary composite score derived from 50+
													quantitative and qualitative variables.
												</>,
												<>
													<span className="font-semibold text-primary">The Depth Leaderboard</span> displays the average
													depth of liquidity for each market maker across +/- 0.50%, +/- 1.00%, & +/- 2.00% for all of
													their respective active engagements being tracked by Forgd. Both the average notional depth
													and the average percentage of all depth is provided on a per market maker basis. Additionally,
													the average depth loan utilization is calculated for each market maker.
												</>,
												<>
													<span className="font-semibold text-primary">The Volume Leaderboard</span> provides insights
													to the average maker fill order volume, the average taker fill order volume, the average total
													fill order volume (maker + taker), and the average volume loan utilization for each market
													maker across all of their active engagements that Forgd tracks.
												</>,
												<>
													<span className="font-semibold text-primary">The Spread Leaderboard</span> shows the average
													volume-weighted bid-ask spread across each market maker's active engagements. By using the
													volume-weighted bid-ask spread, we account for the notional size of orders at the best bid and
													the best ask, providing a more accurate reflection of implied transaction costs.
												</>,
												<>
													<span className="font-semibold text-primary">The KPI Adherence Leaderboard</span> tracks the
													uptime of market makers across their active engagements using industry standard KPIs (depth
													+/- 0.50%, +/- 1.00%, & +/- 2.00%, and top-of-book spreads). This measures the consistency
													with which market makers meet predefined performance thresholds, calculated as the proportion
													of successful KPI outcomes over time using a daily binary pass/fail framework.
												</>
											]}
										/>
										<P>
											Each leaderboard is further outlined in the documentation that follows with details on the
											significance of each, the calculation methodologies and how to navigate the various filter views.
											Project founders, advisors, investors and researchers can use the Market Maker Leaderboards to
											inform their decision around the right engagement structure or partner to align with for their
											token.
										</P>
									</Section>

									<Divider />

									<Section id="performance-index" title="2. Performance Index">
										<SubHeading>Overview</SubHeading>
										<P>
											The Performance Index ranks market makers based on a proprietary composite score derived from 50+
											quantitative and qualitative variables across their tracked engagements. It provides a unified
											view of overall performance by aggregating granular trading KPIs, including liquidity provision,
											execution quality, and operational consistency, alongside infrastructure, integration, and
											coverage-related attributes such as exchange integrations, API capabilities, and participation
											across CEXs, DEXs, and ancillary trading functions.
										</P>
										<FigureTable
											src={docsAsset('performance_index.png')}
											alt="Forgd Market Maker Performance Index leaderboard table"
											caption="Supporting fields within the table provide additional context on each market maker's infrastructure and capabilities, and a “Details” view allows for a more granular breakdown of performance and characteristics. Screenshot taken April 16, 2026."
										/>
										<SubHeading>Calculation Methodology</SubHeading>
										<P>
											The Performance Index is calculated using a proprietary weighted composite model that incorporates
											over 50 underlying KPIs. These KPIs are measured at a granular level and may differentiate across
											specific dimensions (e.g., depth at varying thresholds, bid vs. ask side behavior, and execution
											characteristics).
										</P>
										<P>
											Each KPI contributes to the composite score with its own weighting, reflecting its relative
											importance within the overall evaluation framework. In addition to quantitative trading metrics,
											select infrastructure and capability-based attributes, such as integrations, API support, and
											trading coverage, are also incorporated into the composite calculation. The global weights of each
											metric are as follows:
										</P>
										<WeightTable rows={PERFORMANCE_GLOBAL_WEIGHTS} showRanking={false} />
										<P>
											The Trading KPI component evaluates a market maker's performance across four core dimensions:
											liquidity depth, execution quality, capital efficiency, and operational reliability. Depth is
											measured at +/- 0.50%, +/- 1.00%, & +/- 2.00% in both USD and % of market, with a bias toward
											bid-side liquidity. Execution quality is captured through maker and taker volume, with greater
											emphasis on passive (maker) activity, while loan utilization measures how efficiently capital is
											deployed. Uptime and bid-ask spread reflect consistency and quote competitiveness. The weightings
											and rankings of all Trading KPIs are below:
										</P>
										<WeightTable rows={PERFORMANCE_KPI_WEIGHTS} />
										<P>
											All values are aggregated across each market maker's active engagements tracked by Forgd and are
											recalculated dynamically based on the selected timeframe.
										</P>
										<SubHeading>How to Interpret</SubHeading>
										<P>
											The composite score represents a relative measure of overall performance across all included
											dimensions. Higher-ranked market makers have demonstrated stronger aggregate performance across
											the full set of evaluated KPIs and attributes within the selected timeframe. Supporting columns
											should be used to contextualize the composite score. For example:
										</P>
										<Bullets
											ordered
											items={[
												"Trading KPIs benchmark market makers' raw performance against one another.",
												'Trust & Integration provide visibility into their infrastructure and connectivity.',
												'Coverage & Capabilities reflects the breadth of participation across CEXs, DEXs, and additional trading functions.',
												'Uptime indicates operational consistency over the selected period.',
												"Integration Level reflects the degree of integration with Forgd's data consumption systems."
											]}
										/>
										<FigureRadar
											src={docsAsset('radar_mm_details.png')}
											alt="Market Maker detail view — Leaderboard Performance radar chart"
										/>
										<P>
											Market makers may share the same rank in cases where composite scores are equivalent when rounded
											to one decimal place.
										</P>
										<SubHeading>Filtering</SubHeading>
										<P>
											Timeframe filtering can be configured under the “Refine” button at the top right of the table. All
											Performance Index values, including the composite score, rankings, and supporting metrics, are
											recalculated dynamically based on the selected timeframe.
										</P>
									</Section>

									<Divider />

									<Section id="depth-leaderboard" title="3. Depth Leaderboard">
										<SubHeading>Overview</SubHeading>
										<P>
											The Depth Leaderboard ranks market makers based on the liquidity they provide within defined
											thresholds around the mid-point, offering a comparative view of resting bid and ask depth across
											their tracked engagements. It measures average notional liquidity within +/- 0.50%, +/- 1.00%, &
											+/- 2.00% price bands, representing progressively wider segments of the order book. In addition to
											notional depth, the leaderboard includes each market maker's percentage share of total depth
											within the selected threshold, providing a normalized view of relative liquidity contribution, as
											well as Depth Loan Utilization, which measures the extent to which loaned inventory is used to
											support quoted depth.
										</P>
										<FigureTable
											src={docsAsset('depth_table.png')}
											alt="Market Makers Depth Rank leaderboard table"
											caption="Supporting fields within the table provide additional context on each market maker's infrastructure and capabilities, and a “Details” view allows for a more granular breakdown of performance and characteristics. Screenshot taken April 16, 2026."
										/>
										<SubHeading>Calculation Methodology</SubHeading>
										<P>
											Average notional depth is calculated by measuring the total resting bid and ask liquidity within
											the selected price thresholds (+/- 0.50%, +/- 1.00%, & +/- 2.00%) and averaging these values
											across all tracked engagements for each market maker over the selected timeframe.
										</P>
										<Bullets
											items={[
												<>
													<span className="font-semibold text-primary">% of Total Depth</span> is calculated as each
													market maker's average share of aggregate depth across all resting bids and offers within the
													selected threshold, relative to the total depth provided by all market makers.
												</>,
												<>
													<span className="font-semibold text-primary">Depth Loan Utilization</span> is calculated as
													the ratio of loaned inventory utilized to support quoted depth relative to the total average
													depth provided. Values exceeding 100% indicate that quoted depth exceeds the amount of loaned
													inventory and should be interpreted with caution.
												</>
											]}
										/>
										<P>
											The table below outlines the underlying metrics used to rank market makers on the Depth
											Leaderboard, including their respective weightings and relative importance. These metrics
											primarily capture liquidity provision across defined thresholds around the mid-point, with
											emphasis on bid-side depth, project count, and overall market share.
										</P>
										<WeightTable rows={DEPTH_WEIGHTS} />
										<SubHeading>How to Interpret</SubHeading>
										<P>
											Higher notional depth indicates that a market maker is consistently providing larger amounts of
											liquidity within the selected price thresholds. Depth closer to the mid-point (e.g., +/- 0.50%)
											reflects tighter and more immediately accessible liquidity, while wider thresholds (e.g., +/-
											2.00%) capture broader order book support.
										</P>
										<P>
											% of Total Depth provides context on relative market presence. A higher percentage indicates that
											a market maker contributes a larger share of overall liquidity within the selected threshold
											across all tracked engagements.
										</P>
										<P>
											Depth Loan Utilization reflects how efficiently loaned inventory is being deployed to support
											liquidity. Higher utilization generally indicates more active use of inventory, while values
											exceeding 100% may indicate reliance on additional inventory sources or elevated quoting relative
											to loan size.
										</P>
										<SubHeading>Filtering</SubHeading>
										<P>
											By default, the Depth Leaderboard displays average notional values. Users can switch between
											notional values, percentile rankings, and absolute rank positions. Depth thresholds (+/- 0.50%,
											+/- 1.00%, & +/- 2.00%) can be selected to filter the displayed data across all market makers.
										</P>
										<P>
											Timeframe filtering can be configured under the “Refine” button at the top right of the table. All
											depth metrics are recalculated dynamically based on the selected timeframe.
										</P>
									</Section>

									<Divider />

									<Section id="volume-leaderboard" title="4. Volume Leaderboard">
										<SubHeading>Overview</SubHeading>
										<P>
											The Volume Leaderboard ranks market makers based on the trading activity they generate across
											their tracked engagements, providing a comparative view of executed volume segmented by maker and
											taker activity. It measures average maker fill volume (passive liquidity provision), taker fill
											volume (active liquidity taking), and total executed volume, allowing users to assess how market
											makers participate in trading flows. The leaderboard also includes Volume Loan Utilization, which
											measures the relationship between executed trading activity and the amount of loaned inventory,
											providing additional context on inventory turnover relative to trading activity.
										</P>
										<FigureTable
											src={docsAsset('volume_table_perc.png')}
											alt="Market Makers Volume Rank leaderboard table"
											caption="Screenshot taken April 16, 2026."
										/>
										<SubHeading>Calculation Methodology</SubHeading>
										<P>
											Average Maker Fill Volume and Average Taker Fill Volume are calculated by measuring executed
											trading volume attributable to each activity type and averaging these values across all tracked
											engagements for each market maker over the selected timeframe.
										</P>
										<Bullets
											items={[
												<>
													<span className="font-semibold text-primary">Average Total Volume</span> is calculated as the
													sum of maker and taker fill volumes.
												</>,
												<>
													<span className="font-semibold text-primary">Volume Loan Utilization</span> is calculated as
													the average total executed volume per period divided by the amount of loaned inventory. This
													reflects the level of trading activity generated relative to available inventory.
												</>
											]}
										/>
										<P>
											The table below details how market makers are evaluated on the Volume Leaderboard, including the
											weighting of each underlying metric. The framework is centered on passive trading activity, with
											greater emphasis placed on maker fill volume and overall participation in market turnover.
										</P>
										<WeightTable rows={VOLUME_WEIGHTS} />
										<SubHeading>How to Interpret</SubHeading>
										<P>
											Higher total volume indicates greater overall participation in trading activity across tracked
											engagements.
										</P>
										<Bullets
											items={[
												<>
													<span className="font-semibold text-primary">Maker Fill Volume</span> reflects passive
													execution, where trades occur against resting liquidity provided by the market maker.
												</>,
												<>
													<span className="font-semibold text-primary">Taker Fill Volume</span> reflects active
													execution, where the market maker is crossing the spread to trade against existing liquidity.
												</>
											]}
										/>
										<P>
											The relationship between maker and taker volume provides additional context on how trading
											activity is generated, though all components contribute to total volume.
										</P>
										<P>
											Volume Loan Utilization reflects how actively loaned inventory is used to generate trading
											activity. Higher utilization indicates greater turnover relative to inventory size.
										</P>
										<SubHeading>Filtering</SubHeading>
										<P>
											By default, the Volume Leaderboard displays average notional values. Users can switch between
											notional values, percentile rankings, and absolute rank positions.
										</P>
										<P>
											Timeframe filtering can be configured under the “Refine” button at the top right of the table. All
											volume metrics are recalculated dynamically based on the selected timeframe.
										</P>
									</Section>

									<Divider />

									<Section id="spread-leaderboard" title="5. Spread Leaderboard">
										<SubHeading>Overview</SubHeading>
										<P>
											The Spread Leaderboard ranks market makers based on the tightness of their quoted bid-ask spreads
											across their tracked engagements, providing a comparative view of pricing efficiency around the
											mid-point. It measures the average bid-ask spread using a volume-weighted methodology, accounting
											for the notional size of orders at the best bid and best ask and ensuring that periods with higher
											trading activity have a greater impact on the final metric. This approach provides a more accurate
											representation of implied transaction costs under active market conditions.
										</P>
										<FigureDualTable
											frontSrc={docsAsset('spread_table_rank_front.png')}
											backSrc={docsAsset('spread_table_val_back.png')}
											alt="Market Makers Spread Rank leaderboard table"
											caption="Screenshot taken April 16, 2026."
										/>
										<SubHeading>Calculation Methodology</SubHeading>
										<Bullets
											items={[
												'The bid-ask spread is calculated as the difference between the best bid and best ask prices and is expressed relative to the mid-point.',
												'Spreads are aggregated using a volume-weighted approach, where each observation is weighted by the corresponding traded volume. This ensures that periods with higher executed volume contribute more significantly to the average spread.',
												'The final value represents the average volume-weighted bid-ask spread across all tracked engagements for each market maker over the selected timeframe.'
											]}
										/>
										<P>
											Below are the key inputs used to rank market makers on the Spread Leaderboard. Weightings are
											primarily driven by volume-weighted bid-ask spreads and the uptime to measure market makers'
											consistency of quoting.
										</P>
										<WeightTable rows={SPREAD_WEIGHTS} />
										<P>
											Volume-weighted average bid-ask spreads ("VWAS") are calculated per market maker on a once-daily
											basis. Each trading pair's spread is weighted by its share of total daily fill volume, and those
											weighted spreads are summed to produce the VWAS. Venues with more volume therefore have a larger
											impact on the final number.
										</P>
										<P>Take the following example where the MM is trading across 5 venues:</P>
										<Bullets
											ordered
											items={[
												'Venue 1: $1.0m @ 5 bps',
												'Venue 2: $750k @ 10 bps',
												'Venue 3: $500k @ 10 bps',
												'Venue 4: $100k @ 50 bps',
												'Venue 5: $10k @ 100 bps'
											]}
										/>
										<P>The total fill volume in this example is $2.36m, allowing us to calculate VWAS as:</P>
										<pre className="overflow-x-auto rounded-md bg-page p-3 text-xs text-primary">
											<code>
												VWAS = [(1.0m×5) + (0.75m×10) + (0.5m×10) + (0.1m×50) + (0.01m×100)] / 2.36m ≈ 9.96 bps (~10
												bps)
											</code>
										</pre>
										<P>
											It's worth noting that even though Venue 5 has a very wide spread, its impact is minimal due to
											low volume, while the high-volume venues dominate the result.
										</P>
										<SubHeading>How to Interpret</SubHeading>
										<P>
											Lower bid-ask spreads indicate tighter pricing around the prevailing price, or the mid-point,
											reflecting more competitive quoting.
										</P>
										<P>
											Because spreads are volume-weighted, the metric emphasizes pricing behavior during periods of
											meaningful trading activity. As a result, the leaderboard reflects effective spread performance
											under active market conditions rather than purely static quoting.
										</P>
										<P>
											Comparisons across market makers should be made within the same selected timeframe to ensure
											consistency.
										</P>
										<SubHeading>Filtering</SubHeading>
										<P>
											By default, the Spread Leaderboard displays average notional values. Users can switch between
											percentile rankings and absolute rank positions.
										</P>
										<P>
											Timeframe filtering can be configured under the “Refine” button at the top right of the table. All
											spread metrics are recalculated dynamically based on the selected timeframe.
										</P>
									</Section>

									<Divider />

									<Section id="kpi-adherence-leaderboard" title="6. KPI Adherence Leaderboard">
										<SubHeading>Overview</SubHeading>
										<P>
											The KPI Adherence Leaderboard ranks market makers based on the consistency with which they meet
											predefined performance thresholds across their tracked engagements. It evaluates adherence to
											industry standard KPIs, including depth thresholds (+/- 0.50%, +/- 1.00%, & +/- 2.00%) and
											top-of-book spread requirements, using a daily binary pass/fail framework. These outcomes are
											aggregated over time to measure the proportion of successful KPI instances, providing a
											standardized view of operational consistency across market makers.
										</P>
										<FigureTable
											src={docsAsset('kpi_table.png')}
											alt="Market Makers % Uptime Rank leaderboard table"
											caption="Screenshot taken April 16, 2026."
										/>
										<SubHeading>Calculation Methodology</SubHeading>
										<P>
											KPI adherence is calculated on a monthly basis by evaluating daily performance against predefined
											thresholds for each KPI.
										</P>
										<P>For each day and each KPI, a binary value is assigned:</P>
										<Bullets items={['1 (pass) if the KPI is met', '0 (fail) if the KPI is not met']} />
										<P>
											These binary outcomes are aggregated across all days in the month and across all tracked
											engagements for each market maker.
										</P>
										<P>
											The final KPI adherence value represents the proportion of “pass” instances relative to the total
											number of evaluated instances.
										</P>
										<P>
											The table below outlines how KPI adherence is measured and ranked across market makers. The
											weighting reflects the relative importance of maintaining depth and spread requirements over time,
											based on daily pass/fail outcomes.
										</P>
										<WeightTable rows={KPI_WEIGHTS} />
										<SubHeading>How to Interpret</SubHeading>
										<P>
											Higher KPI adherence indicates that a market maker consistently meets predefined performance
											thresholds across their engagements.
										</P>
										<P>
											Because adherence is measured as a proportion of successful outcomes over time, the metric
											reflects reliability and consistency rather than magnitude of performance.
										</P>
										<P>
											Lower adherence indicates more frequent deviations from required thresholds, even if other
											performance metrics (e.g., depth or volume) may be strong.
										</P>
										<P>
											Comparisons across market makers should be made within the same selected timeframe to ensure
											consistency.
										</P>
										<SubHeading>Filtering</SubHeading>
										<P>
											By default, the KPI Adherence Leaderboard displays average notional values. Users can switch
											between percentile rankings and absolute rank positions. Depth thresholds (+/- 0.50%, +/- 1.00%, &
											+/- 2.00%) can be selected to filter KPI adherence results based on the corresponding performance
											criteria.
										</P>
										<P>
											Timeframe filtering can be configured under the “Refine” button at the top right of the table. All
											KPI adherence metrics are recalculated dynamically based on the selected timeframe.
										</P>
									</Section>

									<Divider />

									<Section id="glossary" title="7. Glossary">
										<div className="flex flex-col gap-5">
											{GLOSSARY.map((entry) => (
												<GlossaryItem key={entry.term} entry={entry} />
											))}
										</div>
									</Section>
								</div>
							</div>
						</div>

						<aside className="hidden min-[1120px]:block min-[1120px]:border-l min-[1120px]:border-subtle min-[1120px]:pl-8">
							<div className="sticky top-6">
								<div className="flex h-9 items-center">
									<span className="label-sm text-secondary uppercase">Table of Contents</span>
								</div>
								<div className="mt-3 border-t border-subtle" />
								<div className="pt-6">
									<TocList active={active} />
								</div>
							</div>
						</aside>
					</div>
				</Card>
				<div className="mt-6">
					<MarketMakersOutro />
				</div>
			</div>
		</>
	)
}
