import { useState } from 'react'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { DialogBody, DialogHeader, SideSheet } from '~/ui/Dialog'
import { RailItem } from '~/ui/RailItem'
import { docsAsset, FigureRadar, FigureTable } from './DocsFigures'
import { GRADE_BANDS } from './gradeBands'
import {
	PI_COMPONENT_SECTIONS,
	PI_COMPOSITE_SCORE_INTRO,
	PI_FIGURE_CAPTION,
	PI_GRADE_SUMMARY,
	PI_METHODOLOGY_INTRO,
	PI_OVERVIEW_PARAGRAPHS,
	PI_SAME_RANK_NOTE
} from './performanceIndexDocs'

const TOC = [
	{ id: 'overview', label: '1. Overview' },
	{ id: 'calculation-methodology', label: '2. Calculation methodology' },
	{ id: 'how-to-interpret', label: '3. How to interpret' },
	{ id: 'filtering', label: '4. Filtering' }
]

const WEIGHTS = [
	{ metric: 'Trading KPIs', weighting: '40%' },
	{ metric: 'Trust & Integration', weighting: '20%' },
	{ metric: 'Coverage & Capabilities', weighting: '15%' },
	{ metric: 'Uptime', weighting: '10%' },
	{ metric: 'Integration Level', weighting: '15%' }
]

const TRADING_KPIS = [
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
	{ metric: 'Bid Depth 100 bps, % of Market', weighting: '2.50%', ranking: 13 },
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

const INTERPRET = [
	{ term: 'Trading KPIs', rest: 'benchmark market makers’ raw performance against one another.' },
	{
		term: 'Trust',
		rest: 'is measured based on the number of engagements tracked and instances of trading abnormalities from tracked engagements.'
	},
	{
		term: 'Coverage & Capabilities',
		rest: 'reflects the breadth of trading coverage across CEXs & DEXs as well as additional trading functions.'
	},
	{ term: 'Uptime', rest: 'indicates operational consistency over the selected period.' },
	{ term: 'Integration Level', rest: 'reflects the degree of integration with Forgd’s data consumption systems.' }
]

const TH = 'bg-brand px-4 py-2.5 text-center label-sm text-on-brand'
const TD = 'border-b border-subtle px-4 py-2 body-sm text-secondary'

function DocFileIcon() {
	return (
		<svg
			width="17"
			height="21"
			viewBox="0 0 17 21"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="shrink-0 text-link"
			aria-hidden
		>
			<path
				d="M15.75 12.75V10.125C15.75 8.26104 14.239 6.75 12.375 6.75H10.875C10.2537 6.75 9.75 6.24632 9.75 5.625V4.125C9.75 2.26104 8.23896 0.75 6.375 0.75H4.5M4.5 13.5H12M4.5 16.5H8.25M6.75 0.75H1.875C1.25368 0.75 0.75 1.25368 0.75 1.875V19.125C0.75 19.7463 1.25368 20.25 1.875 20.25H14.625C15.2463 20.25 15.75 19.7463 15.75 19.125V9.75C15.75 4.77944 11.7206 0.75 6.75 0.75Z"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export function DocsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [activeId, setActiveId] = useState(TOC[0].id)

	// Highlights the section nearest the top of the sheet's scrolling body. It attaches when the sheet's portal
	// mounts the sections, which happens after `open` turns true.
	const spySections = (sections: HTMLDivElement | null) => {
		if (!sections) return
		const root = sections.closest<HTMLElement>('[data-sheet]')
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
				if (visible[0]) setActiveId(visible[0].target.id)
			},
			{ root, rootMargin: '0px 0px -75% 0px', threshold: 0 }
		)
		for (const section of sections.querySelectorAll('section[id]')) observer.observe(section)
		return () => observer.disconnect()
	}

	const scrollToSection = (id: string) => {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		setActiveId(id)
	}

	return (
		<SideSheet size="lg" open={open} onClose={onClose} portal unmountOnHide>
			<DialogHeader title="Performance Index documentation" />
			<DialogBody kind="flush">
				<div className="flex flex-col md:flex-row">
					<nav
						aria-label="Table of contents"
						className="border-b border-subtle md:w-64 md:shrink-0 md:self-stretch md:border-r md:border-b-0"
					>
						<div className="md:sticky md:top-0">
							<h3 className="px-4 pt-4 pb-2 label-md text-secondary">Table of contents</h3>
							<ul className="flex flex-col gap-1 px-2 pb-3">
								{TOC.map((item) => {
									const active = item.id === activeId
									return (
										<li key={item.id}>
											<RailItem
												as="button"
												type="button"
												active={active}
												aria-current={active ? 'location' : undefined}
												onClick={() => scrollToSection(item.id)}
											>
												{item.label}
											</RailItem>
										</li>
									)
								})}
							</ul>
						</div>
					</nav>

					<div ref={spySections} className="flex min-w-0 flex-1 flex-col gap-8 p-4 md:p-6">
						<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-subtle bg-brand-muted p-2">
							<div className="flex items-start gap-2 label-md">
								<span className="flex h-lh shrink-0 items-center">
									<DocFileIcon />
								</span>
								<p className="text-primary">Looking for the full Market Maker Leaderboard documentation?</p>
							</div>
							<Button as={BasicLink} href="/market-makers/documentation" variant="primary" size="md">
								Read the docs
							</Button>
						</div>

						<section id="overview" className="flex scroll-mt-4 flex-col gap-5">
							<h2 className="label-lg text-primary">Overview</h2>
							{PI_OVERVIEW_PARAGRAPHS.map((paragraph) => (
								<p key={paragraph} className="body-md text-secondary">
									{paragraph}
								</p>
							))}
							<FigureTable
								src={docsAsset('performance_index.png')}
								alt="Performance Index leaderboard table"
								caption={PI_FIGURE_CAPTION}
							/>
						</section>

						<section id="calculation-methodology" className="flex scroll-mt-4 flex-col gap-5">
							<h2 className="label-lg text-primary">Calculation methodology</h2>
							<p className="body-md text-secondary">{PI_METHODOLOGY_INTRO}</p>
							<p className="body-md text-secondary">
								Each KPI contributes to the composite score with its own weighting, reflecting its relative importance
								within the overall evaluation framework. In addition to quantitative trading metrics, select
								infrastructure and capability-based attributes, such as integrations, API support, and trading coverage,
								are also incorporated into the composite calculation. The global weights of each metric are as follows:
							</p>
							<div className="overflow-x-auto rounded-lg border border-subtle">
								<table className="w-full border-collapse body-sm">
									<thead>
										<tr>
											<th className={TH}>Metric</th>
											<th className={TH}>Weighting</th>
										</tr>
									</thead>
									<tbody>
										{WEIGHTS.map((row) => (
											<tr key={row.metric} className="last:[&>td]:border-b-0">
												<td className={TD}>{row.metric}</td>
												<td className={`${TD} text-center`}>{row.weighting}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<p className="body-md text-secondary">{PI_COMPOSITE_SCORE_INTRO}</p>
							<div className="overflow-x-auto rounded-lg border border-subtle">
								<table className="w-full border-collapse body-sm">
									<thead>
										<tr>
											<th className={`${TH} text-left whitespace-nowrap`}>Composite Score</th>
											<th className={TH}>Grade</th>
											<th className={TH}>Interpretation</th>
										</tr>
									</thead>
									<tbody>
										{GRADE_BANDS.map((band) => (
											<tr key={band.label} className="last:[&>td]:border-b-0">
												<td className={`${TD} whitespace-nowrap`}>{band.range}</td>
												<td className={`${TD} text-center font-medium ${band.colorClassName}`}>{band.label}</td>
												<td className={`${TD} min-w-[260px]`}>{band.interpretation}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<p className="body-md text-secondary">{PI_GRADE_SUMMARY}</p>
							<h3 className="label-md text-primary">Trading KPIs</h3>
							<p className="body-md text-secondary">
								The Trading KPI component evaluates a market maker’s performance across four core dimensions: liquidity
								depth, execution quality, capital efficiency, and operational reliability. Depth is measured at +/-
								0.50%, +/- 1.00%, & +/- 2.00% in both USD and % of market, with a bias toward bid-side liquidity.
								Execution quality is captured through maker and taker volume, with greater emphasis on passive (maker)
								activity, while loan utilization measures how efficiently capital is deployed. Uptime and bid-ask spread
								reflect consistency and quote competitiveness. The weightings and rankings of all Trading KPIs are
								below:
							</p>
							<div className="overflow-x-auto rounded-lg border border-subtle">
								<table className="w-full border-collapse body-sm">
									<thead>
										<tr>
											<th className={TH}>Metric</th>
											<th className={TH}>Weighting</th>
											<th className={TH}>Ranking</th>
										</tr>
									</thead>
									<tbody>
										{TRADING_KPIS.map((row) => (
											<tr key={row.ranking} className="last:[&>td]:border-b-0">
												<td className={TD}>{row.metric}</td>
												<td className={`${TD} text-center`}>{row.weighting}</td>
												<td className={`${TD} text-center`}>{row.ranking}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<p className="body-sm text-secondary">
								All values are aggregated across each market maker’s active engagements tracked by Forgd and are
								recalculated dynamically based on the selected timeframe.
							</p>
							{PI_COMPONENT_SECTIONS.map((component) => (
								<div key={component.title} className="flex flex-col gap-5">
									<h3 className="label-md text-primary">{component.title}</h3>
									{component.paragraphs.map((paragraph) => (
										<p key={paragraph} className="body-md text-secondary">
											{paragraph}
										</p>
									))}
								</div>
							))}
						</section>

						<section id="how-to-interpret" className="flex scroll-mt-4 flex-col gap-5">
							<h2 className="label-lg text-primary">How to interpret</h2>
							<p className="body-md text-secondary">
								The composite score represents a relative measure of overall performance across all included dimensions.
								Higher-ranked market makers have demonstrated stronger aggregate performance across the full set of
								evaluated KPIs and attributes within the selected timeframe. Supporting columns should be used to
								contextualize the composite score. For example:
							</p>
							<ol className="flex list-decimal flex-col gap-2 pl-5 body-md text-secondary">
								{INTERPRET.map((item) => (
									<li key={item.term}>
										<span className="font-medium text-primary">{item.term}</span> {item.rest}
									</li>
								))}
							</ol>
							<p className="body-md text-secondary">{PI_SAME_RANK_NOTE}</p>
							<FigureRadar
								src={docsAsset('radar_mm_details.png')}
								alt="Market maker detail view — leaderboards performance radar"
							/>
						</section>

						<section id="filtering" className="flex scroll-mt-4 flex-col gap-5">
							<h2 className="label-lg text-primary">Filtering</h2>
							<p className="body-md text-secondary">
								Timeframe filtering can be configured under the “Refine” button at the top right of the table. All
								Performance Index values, including the composite score, rankings, and supporting metrics, are
								recalculated dynamically based on the selected timeframe.
							</p>
						</section>
					</div>
				</div>
			</DialogBody>
		</SideSheet>
	)
}
