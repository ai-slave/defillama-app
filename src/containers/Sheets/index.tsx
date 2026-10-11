import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'

const highlightFormula = (formula: string) => {
	const parts = formula.split(/(=\w+|"[^"]*"|[(),])/).filter(Boolean)
	return (
		<span>
			{parts.map((part, i) => {
				if (part.startsWith('='))
					return (
						// oxlint-disable-next-line react/no-array-index-key -- Repeated syntax fragments have positional identity and no local state.
						<span key={i} className="text-link">
							{part}
						</span>
					)
				if (part.startsWith('"'))
					return (
						// oxlint-disable-next-line react/no-array-index-key -- Repeated syntax fragments have positional identity and no local state.
						<span key={i} className="text-sub-live">
							{part}
						</span>
					)
				return (
					// oxlint-disable-next-line react/no-array-index-key -- Repeated syntax fragments have positional identity and no local state.
					<span key={i} className="text-tertiary">
						{part}
					</span>
				)
			})}
		</span>
	)
}

const heroRows = [
	{ num: '1', formula: '=DEFILLAMA("tvl", "ethereum")', value: '$54.5B', selected: true },
	{ num: '2', formula: '=DEFILLAMA("fees-7d", "uniswap")', value: '$14.8M' },
	{ num: '3', formula: '=DEFILLAMA("revenue-30d", "lido")', value: '$5.4M' },
	{ num: '4', formula: '=DEFILLAMA_STABLECOIN_MCAP("USDT")', value: '$183.7B' }
]

const marketMetricsTable = {
	rows: [
		{
			num: '1',
			cells: [
				{ value: '=DEFILLAMA("tvl", "aave")', variant: 'formula' as const },
				{ value: '$27.0B', variant: 'value' as const }
			]
		},
		{
			num: '2',
			cells: [
				{ value: '=DEFILLAMA("fees-24h", "gmx")', variant: 'formula' as const },
				{ value: '$87.9K', variant: 'value' as const }
			]
		},
		{
			num: '3',
			cells: [
				{ value: '=DEFILLAMA("mcap", "sky")', variant: 'formula' as const },
				{ value: '$1.5B', variant: 'value' as const }
			]
		},
		{
			num: '4',
			cells: [
				{ value: '=DEFILLAMA("volume-7d", "uniswap")', variant: 'formula' as const },
				{ value: '$13.5B', variant: 'value' as const }
			]
		}
	]
}

const yieldsTable = {
	formulaBar: '=DEFILLAMA_YIELD("Ethereum", "USDC", "tvl", 3)',
	headers: { labels: ['Chain', 'Project', 'Symbol', 'APY%', 'TVL'] },
	rows: [
		{
			num: '1',
			cells: [
				{ value: 'Ethereum' },
				{ value: 'Maple' },
				{ value: 'USDC' },
				{ value: '4.58%', variant: 'value' as const },
				{ value: '$3.2B', variant: 'value' as const }
			]
		},
		{
			num: '2',
			cells: [
				{ value: 'Ethereum' },
				{ value: 'Aave V3' },
				{ value: 'USDC' },
				{ value: '2.33%', variant: 'value' as const },
				{ value: '$1.2B', variant: 'value' as const }
			]
		},
		{
			num: '3',
			cells: [
				{ value: 'Ethereum' },
				{ value: 'Merkl' },
				{ value: 'USDC' },
				{ value: '0.35%', variant: 'value' as const },
				{ value: '$1.1B', variant: 'value' as const }
			]
		}
	]
}

const stablecoinsTable = {
	rows: [
		{
			num: '1',
			cells: [
				{ value: '=DEFILLAMA_STABLECOIN_MCAP("USDT", "Tron")', variant: 'formula' as const },
				{ value: '$83.8B', variant: 'value' as const }
			]
		},
		{
			num: '2',
			cells: [
				{ value: '=DEFILLAMA_STABLECOIN_MCAP("USDC")', variant: 'formula' as const },
				{ value: '$73.7B', variant: 'value' as const }
			]
		},
		{
			num: '3',
			cells: [
				{ value: '=DEFILLAMA_STABLECOIN_MCAP("DAI")', variant: 'formula' as const },
				{ value: '$4.4B', variant: 'value' as const }
			]
		},
		{
			num: '4',
			cells: [
				{ value: '=DEFILLAMA_STABLECOIN_MCAP("all", "Ethereum")', variant: 'formula' as const },
				{ value: '$159.4B', variant: 'value' as const }
			]
		}
	]
}

const historicalTable = {
	formulaBar: '=DEFILLAMA_HISTORICAL("tvl", "ethereum", "2025-01-01", "2025-01-05")',
	headers: { num: '1', labels: ['Date', 'TVL'] },
	rows: [
		{ num: '2', cells: [{ value: '2025-01-01' }, { value: '$65.3B', variant: 'value' as const }] },
		{ num: '3', cells: [{ value: '2025-01-02' }, { value: '$66.2B', variant: 'value' as const }] },
		{ num: '4', cells: [{ value: '2025-01-03' }, { value: '$67.6B', variant: 'value' as const }] },
		{ num: '5', cells: [{ value: '2025-01-04' }, { value: '$70.2B', variant: 'value' as const }] },
		{ num: '6', cells: [{ value: '2025-01-05' }, { value: '$71.1B', variant: 'value' as const }] }
	]
}

const templates = [
	{
		title: 'Stablecoin Yield Finder',
		desc: 'Find the best stablecoin yields across lending protocols and chains.',
		href: 'https://docs.llama.fi/spreadsheet-functions/templates#stablecoin-yield-finder',
		icon: 'circle-alert' as const
	},
	{
		title: 'Multi-Chain Yield Finder',
		desc: 'Track and compare yield opportunities across multiple chains with earnings calculator.',
		href: 'https://docs.llama.fi/spreadsheet-functions/templates#multi-chain-yield-finder-with-earnings-calculator',
		icon: 'activity' as const
	},
	{
		title: 'Protocol Comparison',
		desc: 'Side-by-side TVL, fees, revenue, and key metrics for any set of protocols.',
		href: 'https://docs.llama.fi/spreadsheet-functions/templates#protocol-comparison-table',
		icon: 'table' as const
	},
	{
		title: 'Chain Comparison',
		desc: 'Side-by-side metrics for multiple chains including TVL, fees, and users.',
		href: 'https://docs.llama.fi/spreadsheet-functions/templates#chain-comparison-table',
		icon: 'package' as const
	},
	{
		title: 'Advanced Revenue Table',
		desc: 'Comprehensive financial metrics for revenue-generating protocols.',
		href: 'https://docs.llama.fi/spreadsheet-functions/templates#advanced-revenue-table',
		icon: 'bar-chart-2' as const
	}
]

function SectionSeparator() {
	return <hr className="mx-auto max-w-[1100px] border-subtle" />
}

function HeroMock() {
	const heroGridCols = '36px minmax(0, 1fr) minmax(108px, 0.55fr)'

	return (
		<div className="overflow-hidden rounded-2xl border border-subtle bg-surface">
			<div className="flex items-center gap-2.5 border-b border-subtle px-4 py-2 body-sm">
				<span className="min-w-[36px] rounded-sm border border-medium bg-page px-2 py-0.75 text-center mono-sm text-tertiary">
					B2
				</span>
				<span className="max-w-full min-w-0 truncate mono-sm">{highlightFormula('=DEFILLAMA("tvl", "ethereum")')}</span>
			</div>
			<div className="grid border-b border-subtle bg-surface-elevated-1" style={{ gridTemplateColumns: heroGridCols }}>
				<div className="border-r border-subtle px-3 py-2.5" />
				<div className="flex items-center border-r border-subtle px-3 py-2.5 title-sm tracking-[0.5px] text-tertiary uppercase">
					A
				</div>
				<div className="flex items-center px-3 py-2.5 title-sm tracking-[0.5px] text-tertiary uppercase">B</div>
			</div>
			{heroRows.map((row) => (
				<div
					key={row.num}
					className="grid border-b border-subtle last:border-b-0"
					style={{ gridTemplateColumns: heroGridCols }}
				>
					<div className="flex items-center justify-center border-r border-subtle bg-surface-elevated-1 px-3 py-2.5 body-sm text-tertiary tabular-nums">
						{row.num}
					</div>
					<div className="flex min-w-0 items-center overflow-hidden border-r border-subtle px-3 py-2.5 mono-sm">
						<span className="block max-w-full min-w-0 truncate whitespace-nowrap">{highlightFormula(row.formula)}</span>
					</div>
					<div
						className={`flex items-center px-3 py-2.5 title-sm text-sub-live tabular-nums ${row.selected ? 'rounded-sm ring-2 ring-brand ring-inset' : ''}`}
					>
						{row.value}
					</div>
				</div>
			))}
		</div>
	)
}

function ShowcaseSection({
	overline,
	heading,
	description,
	bullets,
	reversed,
	children
}: {
	overline: string
	heading: string
	description: string
	bullets: Array<string>
	reversed?: boolean
	children: ReactNode
}) {
	return (
		<section className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 md:px-8 md:py-20">
			<div
				className={`grid grid-cols-1 items-center gap-8 md:gap-15 ${reversed ? 'md:grid-cols-[45fr_55fr]' : 'md:grid-cols-[55fr_45fr]'}`}
			>
				<div className={reversed ? 'md:order-2' : ''}>
					<p className="mb-3 title-md tracking-[2px] text-link uppercase">{overline}</p>
					<h2 className="mb-3.5 text-[28px] leading-[1.25] font-bold tracking-[-0.02em]">{heading}</h2>
					<p className="mb-6 body-md text-secondary">{description}</p>
					<ul className="flex flex-col gap-3">
						{bullets.map((bullet) => (
							<li key={bullet} className="flex items-start gap-2.5 body-md text-secondary">
								{/* Centered on the first line of the bullet beside it, whose type sets the line height. */}
								<span className="flex h-lh shrink-0 items-center">
									<span className="flex size-5 items-center justify-center rounded-full bg-brand-tint text-link">
										<Icon name="check" className="size-3" />
									</span>
								</span>
								{bullet}
							</li>
						))}
					</ul>
				</div>
				<div className={reversed ? 'md:order-1' : ''}>{children}</div>
			</div>
		</section>
	)
}

type MockCell = { value: string; variant?: 'value' | 'formula'; colSpan?: number }
type MockRow = { num: string; cells: Array<MockCell> }

const cellClass = (variant?: 'value' | 'formula') =>
	variant === 'value' ? 'title-sm text-sub-live' : variant === 'formula' ? 'mono-sm' : 'body-sm text-secondary'

function MockTable({
	formulaBar,
	headers,
	rows,
	footer
}: {
	formulaBar?: string
	headers?: { num?: string; labels: Array<string> }
	rows: Array<MockRow>
	footer?: MockRow
}) {
	const colCount = headers ? headers.labels.length : rows[0].cells.length
	const valueColTrack = colCount <= 2 ? '96px' : 'minmax(92px, 0.8fr)'
	const gridCols =
		colCount === 1 ? '28px minmax(0, 1fr)' : `28px repeat(${colCount - 1}, minmax(0, 1fr)) ${valueColTrack}`
	const hasRightSeparator = (cells: Array<MockCell>, index: number) => {
		let occupiedColumns = 0
		for (let i = 0; i <= index; i++) {
			occupiedColumns += cells[i].colSpan ?? 1
		}
		return occupiedColumns < colCount
	}

	return (
		<div className="overflow-hidden rounded-xl border border-subtle bg-surface">
			{formulaBar ? (
				<div className="grid grid-cols-[28px_1fr] border-b border-subtle">
					<div className="border-r border-subtle bg-surface-elevated-1 px-2.5 py-2" />
					<p className="flex items-center px-2.5 py-2 mono-sm">{highlightFormula(formulaBar)}</p>
				</div>
			) : null}
			{headers ? (
				<div
					className="border-b border-subtle bg-surface-elevated-1"
					style={{ display: 'grid', gridTemplateColumns: gridCols }}
				>
					<div className="flex items-center justify-center border-r border-subtle bg-surface-elevated-1 px-2.5 py-1.75 body-xs text-tertiary tabular-nums">
						{headers.num}
					</div>
					{headers.labels.map((label, i) => (
						<div
							key={label}
							className={`flex items-center px-2.5 py-1.75 label-xs tracking-[0.3px] text-tertiary uppercase ${i < colCount - 1 ? 'border-r border-subtle' : ''}`}
						>
							{label}
						</div>
					))}
				</div>
			) : null}
			{rows.map((row) => (
				<div
					key={row.num}
					className="border-b border-subtle last:border-b-0"
					style={{ display: 'grid', gridTemplateColumns: gridCols }}
				>
					<div className="flex items-center justify-center border-r border-subtle bg-surface-elevated-1 px-2.5 py-1.75 body-xs text-tertiary tabular-nums">
						{row.num}
					</div>
					{row.cells.map((cell, i) => (
						<div
							// oxlint-disable-next-line react/no-array-index-key -- Cells identify positions in a fixed spreadsheet demonstration.
							key={i}
							className={`flex min-w-0 items-center overflow-hidden px-2.5 py-1.75 whitespace-nowrap tabular-nums ${cellClass(cell.variant)} ${hasRightSeparator(row.cells, i) ? 'border-r border-subtle' : ''}`}
							style={cell.colSpan ? { gridColumn: `span ${cell.colSpan}` } : undefined}
						>
							{cell.variant === 'formula' ? highlightFormula(cell.value) : cell.value}
						</div>
					))}
				</div>
			))}
			{footer ? (
				<div className="border-t border-subtle" style={{ display: 'grid', gridTemplateColumns: gridCols }}>
					<div className="flex items-center justify-center border-r border-subtle bg-surface-elevated-1 px-2.5 py-1.75 body-xs text-tertiary tabular-nums">
						{footer.num}
					</div>
					{footer.cells.map((cell, i) => (
						<div
							// oxlint-disable-next-line react/no-array-index-key -- Cells identify positions in a fixed spreadsheet demonstration.
							key={i}
							className={`flex min-w-0 items-center overflow-hidden px-2.5 py-1.75 whitespace-nowrap tabular-nums ${cellClass(cell.variant)} ${hasRightSeparator(footer.cells, i) ? 'border-r border-subtle' : ''}`}
							style={cell.colSpan ? { gridColumn: `span ${cell.colSpan}` } : undefined}
						>
							{cell.variant === 'formula' ? highlightFormula(cell.value) : cell.value}
						</div>
					))}
				</div>
			) : null}
		</div>
	)
}

function TemplatesSection() {
	return (
		<section className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 md:px-8 md:py-20">
			<div className="mb-12 text-center">
				<h2 className="mb-2.5 text-[32px] font-bold tracking-[-0.02em]">Templates</h2>
				<p className="mx-auto max-w-[500px] body-lg text-secondary">
					Pre-built spreadsheets to get you started. Clone and customize to fit your workflow.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{templates.map((tpl) => (
					<Card
						as="a"
						padding="md"
						key={tpl.title}
						href={tpl.href}
						target="_blank"
						rel="noopener noreferrer"
						data-umami-event="sheets-templates-click"
						data-umami-event-template={tpl.title}
						className="hover-wash-card flex flex-col gap-2.5"
					>
						<div className="flex size-10 items-center justify-center rounded-lg bg-brand-tint text-link">
							<Icon name={tpl.icon} className="size-5" />
						</div>
						<h3 className="title-md">{tpl.title}</h3>
						<p className="body-md text-tertiary">{tpl.desc}</p>
						<span className="mt-auto flex items-center gap-1 label-md text-link">View template &rarr;</span>
					</Card>
				))}
			</div>
		</section>
	)
}

export default function SheetsContainer() {
	const subscribeModalStore = Ariakit.useDialogStore()
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()

	// Opens the add-on's marketplace page for subscribers, else the upgrade path.
	const openAddOn = (url: string) => {
		if (!isAuthenticated || !hasActiveSubscription) {
			setSignupSource('sheets')
			subscribeModalStore.show()
			return
		}
		window.open(url, '_blank')
	}
	const onGoogleSheetsButtonClick = () =>
		openAddOn('https://workspace.google.com/marketplace/app/defillama_sheets/571407189628')
	const onExcelButtonClick = () => openAddOn('https://marketplace.microsoft.com/en-us/product/WA200009711')

	return (
		<>
			<section className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-4 pt-12 pb-15 sm:px-6 md:grid-cols-2 md:gap-15 md:px-8 md:pt-20">
				<div className="flex flex-col gap-5">
					<h2 className="text-2xl font-bold tracking-[-0.02em] text-link">DefiLlama Sheets</h2>
					<h1 className="text-[clamp(32px,4vw,48px)] leading-[1.15] font-extrabold tracking-[-0.03em]">
						Your spreadsheet, powered by DeFi data
					</h1>
					<p className="max-w-[480px] body-lg text-secondary">
						Custom functions that pull TVL, fees, yields, stablecoin stats and historical data for 6,000+ protocols.
					</p>
					<div className="mt-1 flex flex-col gap-3 sm:flex-row">
						<Button
							variant="primary"
							size="lg"
							onClick={onGoogleSheetsButtonClick}
							data-umami-event="sheets-google-sheets-click"
						>
							<img src="/assets/google-sheets.svg" alt="" className="size-[18px]" />
							Google Sheets
						</Button>
						<Button
							variant="primary"
							size="lg"
							onClick={onExcelButtonClick}
							data-umami-event="sheets-excel-addin-click"
						>
							<img src="/assets/microsoft-excel-v2.svg" alt="" className="size-[18px]" />
							Excel Add-in
						</Button>
					</div>
				</div>
				<HeroMock />
			</section>

			<SectionSeparator />
			<ShowcaseSection
				overline="Market Metrics"
				heading="Real-time Protocol & Chain Data"
				description="Access TVL, fees, revenue, market cap, price and more for every protocol and chain. Data refreshes hourly."
				bullets={[
					'30+ metrics including fees, revenue, volume, perps',
					'6,000+ protocols and 400+ chains',
					'24h, 7d, and 30d timeframes'
				]}
			>
				<MockTable {...marketMetricsTable} />
			</ShowcaseSection>
			<SectionSeparator />
			<ShowcaseSection
				overline="Yields"
				heading="Yield Intelligence Across Chains"
				description="Discover the best yield opportunities — filter by chain, token, and APY. Get detailed pool data including IL risk and reward tokens."
				bullets={[
					'Filter pools by chain, token, APY, or TVL',
					'Detailed pool data with IL risk and reward tokens',
					'Top pools discovery and comparison'
				]}
				reversed
			>
				<MockTable {...yieldsTable} />
			</ShowcaseSection>
			<SectionSeparator />
			<ShowcaseSection
				overline="Stablecoins"
				heading="Stablecoin Market Intelligence"
				description="Track stablecoin market caps, peg health, and supply across chains. Monitor historical trends and cross-chain distribution."
				bullets={[
					'Market cap by stablecoin and chain',
					'Historical supply data and trends',
					'Full stablecoin directory with peg types'
				]}
			>
				<MockTable {...stablecoinsTable} />
			</ShowcaseSection>
			<SectionSeparator />
			<ShowcaseSection
				overline="Historical Data"
				heading="Historical Snapshots & Time Series"
				description="Pull historical data for any metric and date range. Build charts and trend analysis with hourly-refreshed data."
				bullets={[
					'Single date or full date range queries',
					'Ascending or descending sort',
					'Perfect for building time-series charts'
				]}
				reversed
			>
				<MockTable {...historicalTable} />
			</ShowcaseSection>
			<SectionSeparator />
			<TemplatesSection />

			<LazySubscribeProModal dialogStore={subscribeModalStore} />
		</>
	)
}
