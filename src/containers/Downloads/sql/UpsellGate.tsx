import { TabProvider, TabList, Tab, TabPanel } from '@ariakit/react'
import { useRouter } from 'next/router'
import { useId, type ReactNode } from 'react'
import { setSignupSource } from '~/auth/signupSource'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon, type IIcon } from '~/ui/Icon'
import { formatNumber, formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import type { FineKind } from './columnKind'
import { Keycap, TypeBadge } from './primitives'

interface UpsellGateProps {
	isAuthenticated: boolean
	isTrial: boolean
}

const FEATURES: Array<{ icon: IIcon['name']; title: string; body: string }> = [
	{
		icon: 'flame',
		title: 'In-browser engine',
		body: 'DuckDB-WASM runs locally — sub-second queries on millions of rows, no servers.'
	},
	{
		icon: 'layers',
		title: '100+ datasets',
		body: 'TVL, fees, yields, stablecoins, hacks, raises, ETFs, bridges — auto-loaded on reference.'
	},
	{
		icon: 'bar-chart-2',
		title: '13 chart types',
		body: 'Line, bar, area, pie, treemap, scatter, candlestick — auto-rendered from any result.'
	},
	{
		icon: 'graduation-cap',
		title: 'Notebooks + playbook',
		body: 'Mix SQL, markdown, and charts in one notebook. 30+ ready-to-run example queries.'
	},
	{
		icon: 'layout-grid',
		title: 'Multi-tab + shortcuts',
		body: 'Cmd+T new tab, Cmd+Enter run, Cmd+1–9 jump — IDE-grade keyboard navigation.'
	},
	{
		icon: 'link',
		title: 'Share & export',
		body: 'Encode any query or notebook to a URL anyone can open. Export results to CSV or JSON.'
	}
]

const PLAN_INCLUDES = [
	'Full SQL Studio access (this page)',
	'1,000 req/min API rate limit',
	'1M API calls per month',
	'Premium endpoints + MCP integration',
	'Everything in the Pro plan'
]

interface SampleRow {
	name: string
	category: string
	fees_30d: number
	revenue_30d: number
	keep_ratio: number
	short: string
}

const SAMPLE_ROWS: Array<SampleRow> = [
	{ name: 'Uniswap V4', category: 'Dexs', fees_30d: 21_801_514, revenue_30d: 0, keep_ratio: 0, short: 'Uniswap V4' },
	{
		name: 'Ethena USDe',
		category: 'Basis Trading',
		fees_30d: 17_544_600,
		revenue_30d: 208_477,
		keep_ratio: 0.011883,
		short: 'Ethena'
	},
	{
		name: 'Morpho Blue',
		category: 'Lending',
		fees_30d: 13_982_470,
		revenue_30d: 0,
		keep_ratio: 0,
		short: 'Morpho'
	},
	{
		name: 'Spark Liquidity Layer',
		category: 'Onchain Capital Allocator',
		fees_30d: 11_329_710,
		revenue_30d: 500_636,
		keep_ratio: 0.044188,
		short: 'Spark'
	},
	{
		name: 'Hyper Foundation HYPE Staking',
		category: 'Staking Pool',
		fees_30d: 7_897_307,
		revenue_30d: 236_919,
		keep_ratio: 0.03,
		short: 'Hyper'
	},
	{
		name: 'Grove Finance',
		category: 'Onchain Capital Allocator',
		fees_30d: 6_492_198,
		revenue_30d: 0,
		keep_ratio: 0,
		short: 'Grove'
	},
	{
		name: 'Aster Perps',
		category: 'Derivatives',
		fees_30d: 6_346_500,
		revenue_30d: 0,
		keep_ratio: 0,
		short: 'Aster'
	}
]

interface AltRow {
	chain: string
	tvl: number
	change_30d: number
	dominance: number
}

const ALT_ROWS: Array<AltRow> = [
	{ chain: 'Ethereum', tvl: 92_510_000_000, change_30d: 0.043, dominance: 0.611 },
	{ chain: 'Solana', tvl: 18_240_000_000, change_30d: 0.082, dominance: 0.121 },
	{ chain: 'BSC', tvl: 9_840_000_000, change_30d: -0.012, dominance: 0.065 },
	{ chain: 'Arbitrum', tvl: 8_120_000_000, change_30d: 0.018, dominance: 0.054 },
	{ chain: 'Tron', tvl: 7_460_000_000, change_30d: 0.004, dominance: 0.049 }
]

interface TableCol<T> {
	name: string
	kind: FineKind
	type: string
	width: number
	get: (row: T) => string | number
}

const SAMPLE_COLS: Array<TableCol<SampleRow>> = [
	{ name: 'name', kind: 'text', type: 'VARCHAR', width: 192, get: (r) => r.name },
	{ name: 'category', kind: 'text', type: 'VARCHAR', width: 188, get: (r) => r.category },
	{ name: 'fees_30d', kind: 'float', type: 'BIGINT', width: 132, get: (r) => r.fees_30d },
	{ name: 'revenue_30d', kind: 'float', type: 'BIGINT', width: 132, get: (r) => r.revenue_30d },
	{ name: 'keep_ratio', kind: 'float', type: 'DOUBLE', width: 116, get: (r) => r.keep_ratio }
]

const ALT_COLS: Array<TableCol<AltRow>> = [
	{ name: 'chain', kind: 'text', type: 'VARCHAR', width: 152, get: (r) => r.chain },
	{ name: 'tvl', kind: 'float', type: 'BIGINT', width: 152, get: (r) => r.tvl },
	{ name: 'change_30d', kind: 'float', type: 'DOUBLE', width: 142, get: (r) => r.change_30d },
	{ name: 'dominance', kind: 'float', type: 'DOUBLE', width: 124, get: (r) => r.dominance }
]

type TabKey = 'notebook' | 'sql' | 'alt'

interface TabDef {
	key: TabKey
	label: string
	kind: 'notebook' | 'sql'
	dirty?: boolean
}

const TABS: Array<TabDef> = [
	{ key: 'notebook', label: 'revenue-capture.nb', kind: 'notebook' },
	{ key: 'sql', label: 'fees-vs-revenue.sql', kind: 'sql' },
	{ key: 'alt', label: 'chains-tvl.sql', kind: 'sql', dirty: true }
]

export function UpsellGate({ isAuthenticated, isTrial }: UpsellGateProps) {
	const router = useRouter()
	const subscriptionHref = `/subscription?returnUrl=${encodeURIComponent(router.asPath)}`

	const heading = 'Unlock SQL Studio'

	const copy = isTrial
		? 'Your trial includes preview-only CSV downloads. Upgrade to the API plan to run SQL queries across every DefiLlama dataset in your browser.'
		: isAuthenticated
			? 'SQL Studio is part of the DefiLlama API plan. Run cross-dataset joins, charts, and notebooks across every dataset DefiLlama tracks — plus full programmatic API access.'
			: 'SQL Studio is part of the DefiLlama API plan. Sign in and subscribe to run cross-dataset joins, charts, and notebooks across every DefiLlama dataset.'

	return (
		<div className="flex flex-col gap-14 pb-8">
			<section className="flex flex-col gap-8 lg:gap-10">
				<header className="flex flex-col gap-5">
					<div className="flex items-center gap-2">
						<span aria-hidden className="inline-block size-1.5 rounded-full bg-brand" />
						<span className="label-xs tracking-[0.18em] text-link uppercase">API plan</span>
					</div>
					<h2 className="heading-lg tracking-tight text-balance text-primary">{heading}</h2>
					<p className="max-w-xl body-lg text-secondary">{copy}</p>
				</header>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
					<ShowcasePane />
					<PricingCard isAuthenticated={isAuthenticated} subscriptionHref={subscriptionHref} />
				</div>
			</section>

			<section className="flex flex-col gap-6">
				<div className="flex items-baseline justify-between gap-3">
					<h3 className="label-xs tracking-[0.18em] text-tertiary uppercase">Everything in SQL Studio</h3>
					<span className="hidden body-sm text-tertiary sm:inline">
						SQL compute runs locally — your API quota stays untouched
					</span>
				</div>
				<div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
					{FEATURES.map((f, i) => (
						<FeatureTile key={f.title} index={i + 1} icon={f.icon} title={f.title} body={f.body} />
					))}
				</div>
			</section>
		</div>
	)
}

function PricingCard({ isAuthenticated, subscriptionHref }: { isAuthenticated: boolean; subscriptionHref: string }) {
	return (
		<div className="flex flex-col gap-6 rounded-xl border border-brand-muted bg-surface p-6 lg:sticky lg:top-4">
			<div className="flex items-center gap-2">
				<span aria-hidden className="inline-block size-1.5 rounded-full bg-brand" />
				<span className="label-xs tracking-[0.18em] text-link uppercase">API plan</span>
			</div>

			<div className="flex flex-col gap-1.5">
				<div className="flex items-baseline gap-1.5">
					<span className="heading-lg tracking-[-0.04em] text-primary tabular-nums">$300</span>
					<span className="label-lg text-secondary">/mo</span>
				</div>
				<span className="body-sm text-tertiary">
					or <span className="text-secondary">$3,000</span> billed yearly
				</span>
			</div>

			<div className="flex flex-col gap-3 border-t border-subtle pt-5">
				<span className="label-xs tracking-[0.18em] text-tertiary uppercase">What's included</span>
				<ul className="flex flex-col gap-2.5">
					{PLAN_INCLUDES.map((item) => (
						<li key={item} className="flex items-start gap-2.5 body-md">
							<span className="flex h-lh shrink-0 items-center">
								<Icon name="check" className="size-3.5 text-link" />
							</span>
							<span className="text-primary">{item}</span>
						</li>
					))}
				</ul>
			</div>

			<div className="flex flex-col gap-2">
				<Button
					as={BasicLink}
					variant="primary"
					size="lg"
					href={subscriptionHref}
					onClick={() => setSignupSource('sql-studio')}
				>
					{isAuthenticated ? 'Upgrade to API plan' : 'Sign in & subscribe'}
					<Icon name="arrow-up-right" className="size-3.5" />
				</Button>
				<span className="body-sm text-tertiary">Cancel anytime · pay with card or crypto</span>
			</div>
		</div>
	)
}

function FeatureTile({
	index,
	icon,
	title,
	body
}: {
	index: number
	icon: IIcon['name']
	title: string
	body: string
}) {
	return (
		<div className="group flex gap-4 border-t border-subtle py-5 transition-colors hover:border-brand-muted">
			<span className="mono-sm-bold text-tertiary tabular-nums">{String(index).padStart(2, '0')}</span>
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center gap-2">
					<Icon name={icon} className="size-3.5 text-link" />
					<span className="title-md text-primary">{title}</span>
				</div>
				<p className="body-md text-secondary">{body}</p>
			</div>
		</div>
	)
}

function ShowcasePane() {
	const id = useId()
	return (
		<div className="flex flex-col overflow-hidden rounded-xl border border-subtle bg-surface">
			<TabProvider defaultSelectedId={`${id}-notebook`} selectOnMove={false}>
				<TabStrip id={id} />
				<TabPanel tabId={`${id}-notebook`} unmountOnHide>
					<NotebookBody />
				</TabPanel>
				<TabPanel tabId={`${id}-sql`} unmountOnHide>
					<QueryBody />
				</TabPanel>
				<TabPanel tabId={`${id}-alt`} unmountOnHide>
					<AltQueryBody />
				</TabPanel>
			</TabProvider>
		</div>
	)
}

function TabStrip({ id }: { id: string }) {
	return (
		<TabList
			aria-label="SQL Studio sample tabs"
			className="flex items-stretch gap-1 overflow-x-auto border-b border-subtle bg-surface-elevated-1 px-2 pt-2"
		>
			{TABS.map((tab) => (
				<Tab
					key={tab.key}
					id={`${id}-${tab.key}`}
					className="group -mb-px flex h-8 max-w-[220px] min-w-[148px] shrink-0 items-center gap-2 rounded-t-md border border-b-0 border-transparent px-2.5 text-secondary transition-colors hover:bg-hover-row hover:text-primary aria-selected:border-subtle aria-selected:bg-surface aria-selected:text-primary"
				>
					<span className="flex size-3 shrink-0 items-center justify-center" aria-hidden>
						{tab.dirty ? <span className="size-1.5 rounded-full bg-warning" /> : null}
					</span>
					<Icon
						name={tab.kind === 'notebook' ? 'layers' : 'file-text'}
						className={`size-3 shrink-0 text-tertiary ${tab.kind === 'notebook' ? 'group-aria-selected:text-link' : 'group-aria-selected:text-secondary'}`}
					/>
					<span className="min-w-0 flex-1 truncate text-left mono-sm">{tab.label}</span>
					<span
						aria-hidden
						className="grid size-4 shrink-0 place-items-center rounded-sm opacity-0 transition-opacity group-hover:opacity-50 group-aria-selected:opacity-50"
					>
						<Icon name="x" className="size-2.5" />
					</span>
				</Tab>
			))}
			<span
				aria-hidden="true"
				className="-mb-px ml-auto inline-flex size-7 shrink-0 items-center justify-center self-center rounded-md text-tertiary"
			>
				<Icon name="plus" className="size-3.5" />
			</span>
		</TabList>
	)
}

function NotebookBody() {
	return (
		<div className="flex flex-col">
			<NotebookHeader />
			<div className="flex flex-col gap-2 p-3">
				<MarkdownCell />
				<SqlNotebookCell />
				<ChartNotebookCell />
				<AddCellBar />
			</div>
		</div>
	)
}

function NotebookHeader() {
	return (
		<div className="flex items-center justify-between gap-3 border-b border-subtle bg-surface-elevated-1 px-4 py-2.5">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="truncate title-md tracking-tight text-primary">Revenue capture across DeFi</span>
				<span className="mono-sm text-tertiary tabular-nums">3 cells · 2 SQL · 1 chart · last run 412ms</span>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<span className="hidden items-center gap-1.5 sm:inline-flex">
					<Keycap>⌘</Keycap>
					<Keycap>↵</Keycap>
				</span>
				<span className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1 title-sm text-on-brand">
					<PlayGlyph />
					Run all
				</span>
			</div>
		</div>
	)
}

function PlayGlyph({ size = 5 }: { size?: number }) {
	const half = size / 2
	return (
		<span
			aria-hidden
			className="block shrink-0"
			style={{
				width: 0,
				height: 0,
				borderTop: `${half}px solid transparent`,
				borderBottom: `${half}px solid transparent`,
				borderLeft: `${size}px solid currentColor`
			}}
		/>
	)
}

function MarkdownCell() {
	return (
		<CellShell focused={false}>
			<CellHeader name="cell_1" badge="md" />
			<div className="px-3 pb-3 pl-9">
				<h4 className="title-md tracking-tight text-primary">Revenue capture across DeFi</h4>
				<p className="mt-1.5 body-sm text-secondary">
					Which protocols earn the most fees, and how much do they keep as revenue? Joining{' '}
					<InlineCode>fees</InlineCode> and <InlineCode>revenue</InlineCode> highlights the high-volume, low-capture
					protocols.
				</p>
			</div>
		</CellShell>
	)
}

function InlineCode({ children }: { children: ReactNode }) {
	return <code className="rounded-sm bg-surface-elevated-1 px-1 py-px mono-sm text-primary">{children}</code>
}

function SqlNotebookCell() {
	return (
		<CellShell focused>
			<CellHeader
				name="cell_2"
				badge="sql"
				action={
					<>
						<span className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 label-xs text-on-brand">
							<PlayGlyph size={4} />
							Run
						</span>
						<span className="hidden items-center gap-1 sm:inline-flex">
							<Keycap muted>⌘</Keycap>
							<Keycap muted>↵</Keycap>
						</span>
						<Icon name="ellipsis" className="size-3.5 text-tertiary" />
					</>
				}
			/>
			<div className="px-3 pb-3 pl-9">
				<pre className="overflow-x-auto rounded-md border border-subtle bg-surface-elevated-1 px-3 py-2 mono-sm text-primary">
					<code>
						<KW>SELECT</KW> f.name, f.category,
						{'\n'}
						{'       '}f.total30d <KW>AS</KW> fees_30d,
						{'\n'}
						{'       '}
						<KW>COALESCE</KW>(r.total30d, <NUM>0</NUM>) <KW>AS</KW> revenue_30d,
						{'\n'}
						{'       '}
						<KW>COALESCE</KW>(r.total30d, <NUM>0</NUM>) / <KW>NULLIF</KW>(f.total30d, <NUM>0</NUM>) <KW>AS</KW>{' '}
						keep_ratio
						{'\n'}
						<KW>FROM</KW> fees f <KW>LEFT JOIN</KW> revenue r <KW>ON</KW> r.name = f.name
						{'\n'}
						<KW>WHERE</KW> f.total30d &gt; <NUM>100000</NUM>
						{'\n'}
						<KW>ORDER BY</KW> f.total30d <KW>DESC</KW> <KW>LIMIT</KW> <NUM>7</NUM>;
					</code>
				</pre>

				<div className="mt-2.5 flex items-center justify-between gap-2 body-xs">
					<span className="text-tertiary">7 rows · 5 cols · 412ms</span>
					<span className="flex items-center gap-1.5 text-success">
						<span aria-hidden className="inline-block size-1.5 rounded-full bg-success" />
						<span className="tracking-[0.12em] uppercase">cached</span>
					</span>
				</div>
				<div className="mt-1.5 overflow-hidden rounded-md border border-subtle">
					<GridTable rows={SAMPLE_ROWS.slice(0, 3)} cols={SAMPLE_COLS} />
					<div className="border-t border-subtle bg-surface-elevated-1 px-3 py-1.5 mono-sm text-tertiary">
						… 4 more rows
					</div>
				</div>
			</div>
		</CellShell>
	)
}

function ChartNotebookCell() {
	return (
		<CellShell focused={false}>
			<CellHeader
				name="cell_3"
				badge="chart"
				action={
					<span className="inline-flex items-center gap-1.5 rounded-md border border-medium bg-surface px-2 py-0.5 mono-sm text-secondary">
						<span className="text-tertiary">source</span>
						<span className="text-primary">cell_2</span>
						<span aria-hidden className="text-tertiary">
							·
						</span>
						<span className="tabular-nums">7 × 5</span>
						<Icon name="chevron-down" className="size-3 text-tertiary" />
					</span>
				}
			/>
			<div className="px-3 pb-3 pl-9">
				<div className="rounded-md border border-subtle bg-surface-elevated-1 px-3 pt-3">
					<div className="mb-2 flex items-baseline justify-between">
						<span className="label-xs tracking-[0.18em] text-tertiary uppercase">30d fees by protocol</span>
						<span className="mono-sm text-tertiary tabular-nums">bar · top 7</span>
					</div>
					<FeesChart height={108} />
				</div>
			</div>
		</CellShell>
	)
}

function CellShell({ focused, children }: { focused: boolean; children: ReactNode }) {
	return (
		<div
			className={`relative rounded-md border transition-colors ${
				focused ? 'border-brand-strong bg-surface ring-1 ring-brand-muted' : 'border-subtle bg-surface'
			}`}
		>
			{children}
		</div>
	)
}

function CellHeader({ name, badge, action }: { name: string; badge: 'sql' | 'md' | 'chart'; action?: ReactNode }) {
	return (
		<div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
			<Icon name="menu" className="size-3 shrink-0 text-tertiary" />
			<span className="mono-sm text-tertiary">{name}</span>
			<CellTypeBadge kind={badge} />
			{action ? <div className="ml-auto flex items-center gap-1.5">{action}</div> : null}
		</div>
	)
}

function CellTypeBadge({ kind }: { kind: 'sql' | 'md' | 'chart' }) {
	const map = {
		sql: { label: 'SQL', cls: 'bg-brand-tint text-link' },
		md: { label: 'MD', cls: 'bg-pro-ai-tint text-pro-ai-text' },
		chart: { label: 'CHART', cls: 'bg-warning-tint text-warning' }
	}[kind]
	return (
		<span
			className={`inline-flex h-[14px] items-center rounded-[3px] px-1 label-xs tracking-wider uppercase ${map.cls}`}
		>
			{map.label}
		</span>
	)
}

function AddCellBar() {
	return (
		<div className="group flex items-center gap-2 pt-1">
			<span aria-hidden className="h-px flex-1 bg-border-subtle" />
			<span className="inline-flex items-center gap-3 rounded-md body-sm text-tertiary">
				<AddCellChip dot="bg-brand" label="Query" />
				<AddCellChip dot="bg-warning" label="Visualize" />
				<AddCellChip dot="bg-pro-ai" label="Narrate" />
			</span>
			<span aria-hidden className="h-px flex-1 bg-border-subtle" />
		</div>
	)
}

function AddCellChip({ dot, label }: { dot: string; label: string }) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5">
			<span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
			<span>{label}</span>
		</span>
	)
}

function QueryBody() {
	return (
		<div className="flex flex-col">
			<div className="flex items-center justify-between gap-3 border-b border-subtle bg-surface-elevated-1 px-4 py-2">
				<div className="flex items-center gap-2 truncate">
					<Icon name="file-text" className="size-3.5 shrink-0 text-link" />
					<span className="truncate mono-sm text-secondary">fees-vs-revenue.sql</span>
				</div>
				<span className="flex shrink-0 items-center gap-2 body-sm">
					<span aria-hidden className="inline-block size-1.5 rounded-full bg-success" />
					<span className="label-xs tracking-[0.12em] text-success uppercase">ready</span>
					<span aria-hidden className="text-tertiary">
						·
					</span>
					<span className="text-tertiary">412ms</span>
					<span aria-hidden className="hidden text-tertiary sm:inline">
						·
					</span>
					<span className="hidden sm:inline-flex">
						<Keycap>⌘↵</Keycap>
					</span>
				</span>
			</div>

			<div className="border-b border-subtle bg-surface-elevated-1 px-4 py-3">
				<pre className="overflow-x-auto mono-sm text-primary">
					<code>
						<COMMENT>-- Which protocols earn the most fees, and how much do they capture as revenue?</COMMENT>
						{'\n'}
						<KW>SELECT</KW> f.name, f.category,
						{'\n'}
						{'       '}f.total30d <KW>AS</KW> fees_30d,
						{'\n'}
						{'       '}
						<KW>COALESCE</KW>(r.total30d, <NUM>0</NUM>) <KW>AS</KW> revenue_30d,
						{'\n'}
						{'       '}
						<KW>COALESCE</KW>(r.total30d, <NUM>0</NUM>) / <KW>NULLIF</KW>(f.total30d, <NUM>0</NUM>) <KW>AS</KW>{' '}
						keep_ratio
						{'\n'}
						<KW>FROM</KW> fees f{'\n'}
						<KW>LEFT JOIN</KW> revenue r <KW>ON</KW> r.name = f.name
						{'\n'}
						<KW>WHERE</KW> f.total30d &gt; <NUM>100000</NUM>
						{'\n'}
						{'  '}
						<KW>AND</KW> <KW>COALESCE</KW>(r.total30d, <NUM>0</NUM>) / <KW>NULLIF</KW>(f.total30d, <NUM>0</NUM>) &lt;{' '}
						<NUM>0.05</NUM>
						{'\n'}
						<KW>ORDER BY</KW> f.total30d <KW>DESC</KW> <KW>LIMIT</KW> <NUM>30</NUM>;
					</code>
				</pre>
			</div>

			<div className="border-b border-subtle">
				<GridTable rows={SAMPLE_ROWS} cols={SAMPLE_COLS} />
			</div>

			<div className="flex flex-col gap-3 px-4 py-3.5">
				<div className="flex items-baseline justify-between">
					<span className="label-xs tracking-[0.18em] text-tertiary uppercase">30d fees by protocol</span>
					<span className="mono-sm text-tertiary tabular-nums">bar · top 7</span>
				</div>
				<FeesChart />
			</div>
		</div>
	)
}

function AltQueryBody() {
	return (
		<div className="flex flex-col">
			<div className="flex items-center justify-between gap-3 border-b border-subtle bg-surface-elevated-1 px-4 py-2">
				<div className="flex items-center gap-2 truncate">
					<Icon name="file-text" className="size-3.5 shrink-0 text-tertiary" />
					<span className="truncate mono-sm text-secondary">chains-tvl.sql</span>
					<span aria-hidden className="ml-1 inline-block size-1.5 rounded-full bg-warning" />
					<span className="label-xs tracking-[0.12em] text-warning uppercase">unsaved</span>
				</div>
				<span className="flex shrink-0 items-center gap-2 body-sm">
					<span className="text-tertiary">86ms</span>
				</span>
			</div>

			<div className="border-b border-subtle bg-surface-elevated-1 px-4 py-3">
				<pre className="overflow-x-auto mono-sm text-primary">
					<code>
						<COMMENT>-- Top L1 chains by TVL with rolling 30d change and dominance</COMMENT>
						{'\n'}
						<KW>SELECT</KW> name <KW>AS</KW> chain, tvl,
						{'\n'}
						{'       '}rolling_30d_change <KW>AS</KW> change_30d,
						{'\n'}
						{'       '}tvl / <KW>SUM</KW>(tvl) <KW>OVER</KW> () <KW>AS</KW> dominance
						{'\n'}
						<KW>FROM</KW> chains
						{'\n'}
						<KW>WHERE</KW> tvl &gt; <NUM>1000000000</NUM>
						{'\n'}
						<KW>ORDER BY</KW> tvl <KW>DESC</KW> <KW>LIMIT</KW> <NUM>5</NUM>;
					</code>
				</pre>
			</div>

			<GridTable rows={ALT_ROWS} cols={ALT_COLS} />
		</div>
	)
}

function GridTable<T>({ rows, cols }: { rows: Array<T>; cols: Array<TableCol<T>> }) {
	const gridTemplate = cols.map((c) => `${c.width}px`).join(' ')
	const totalWidth = cols.reduce((sum, c) => sum + c.width, 0)
	return (
		<div className="overflow-x-auto">
			<div style={{ width: totalWidth, minWidth: '100%' }}>
				<div
					className="grid border-b border-subtle bg-surface mono-sm text-secondary"
					style={{ gridTemplateColumns: gridTemplate, height: 42 }}
				>
					{cols.map((col) => {
						const isNumeric = col.kind === 'float' || col.kind === 'int'
						return (
							<div
								key={col.name}
								className={`flex flex-col justify-center gap-0.5 truncate border-l border-subtle px-2.5 first:border-l-0 ${
									isNumeric ? 'items-end text-right' : 'items-start text-left'
								}`}
							>
								<div className="flex items-center gap-1.5">
									<TypeBadge kind={col.kind} />
									<span className="truncate mono-sm-bold text-primary">{col.name}</span>
								</div>
								<span className="truncate mono-sm tracking-tight text-tertiary">{col.type}</span>
							</div>
						)
					})}
				</div>
				{rows.map((row, i) => {
					const zebra = i % 2 === 1
					return (
						<div
							// oxlint-disable-next-line react/no-array-index-key -- This table only renders fixed demonstration datasets.
							key={i}
							className={`grid mono-sm tabular-nums transition-colors hover:bg-hover-row ${
								zebra ? 'bg-hover-card' : ''
							}`}
							style={{ gridTemplateColumns: gridTemplate, height: 28 }}
						>
							{cols.map((col) => {
								const value = col.get(row)
								const isNumeric = col.kind === 'float' || col.kind === 'int'
								return (
									<div
										key={col.name}
										className={`flex items-center truncate border-l border-subtle px-2.5 first:border-l-0 ${
											isNumeric ? 'justify-end' : ''
										} text-primary`}
									>
										<span className="truncate">{formatCellValue(value)}</span>
									</div>
								)
							})}
						</div>
					)
				})}
			</div>
		</div>
	)
}

function FeesChart({ height = 132 }: { height?: number }) {
	const data = SAMPLE_ROWS.map((r, i) => ({
		label: r.short,
		value: r.fees_30d,
		tone: BAR_TONES[i] ?? 'bg-brand opacity-40'
	}))
	const dataMax = Math.max(...data.map((d) => d.value))
	const yMax = niceCeiling(dataMax)
	const ticks = Array.from({ length: 6 }, (_, i) => (yMax * i) / 5)
	const Y_AXIS_WIDTH = 38

	return (
		<div className="flex w-full" style={{ paddingBottom: 22 }}>
			<div
				className="flex shrink-0 flex-col-reverse justify-between mono-sm text-tertiary tabular-nums"
				style={{ width: Y_AXIS_WIDTH, height }}
			>
				{ticks.map((t) => (
					<span key={t} className="pr-1.5 text-right">
						{formatTick(t)}
					</span>
				))}
			</div>

			<div className="relative flex-1">
				<div className="pointer-events-none absolute inset-0 flex flex-col-reverse justify-between">
					{ticks.map((t, i) => (
						<div key={t} className={`border-t ${i === 0 ? 'border-subtle' : 'border-dashed border-subtle'}`} />
					))}
				</div>

				<div className="relative flex items-end gap-2 px-1" style={{ height }}>
					{data.map((b) => {
						const h = (b.value / yMax) * height
						return (
							<div key={b.label} className="group relative flex flex-1 flex-col items-center justify-end">
								<span className="mb-1 mono-sm text-secondary tabular-nums">{formatCompactUsd(b.value)}</span>
								<div
									className={`w-full rounded-t-[3px] ${b.tone} transition-[filter] group-hover:brightness-110`}
									style={{ height: Math.max(h, 1.5) }}
								/>
								<span
									className="absolute truncate mono-sm text-tertiary"
									style={{ top: '100%', marginTop: 6, maxWidth: '100%' }}
								>
									{b.label}
								</span>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

// The sample chart is illustration, so its bars fade the brand fill with opacity rather than a ramp step.
const BAR_TONES = [
	'bg-brand',
	'bg-brand opacity-80',
	'bg-brand opacity-60',
	'bg-brand opacity-60',
	'bg-brand opacity-40',
	'bg-brand opacity-40',
	'bg-brand opacity-40'
]

function KW({ children }: { children: ReactNode }) {
	return <span className="font-semibold text-link">{children}</span>
}

function NUM({ children }: { children: ReactNode }) {
	return <span className="text-success">{children}</span>
}

function COMMENT({ children }: { children: ReactNode }) {
	return <span className="text-tertiary italic">{children}</span>
}

function formatCellValue(value: string | number): string {
	if (typeof value === 'string') return value
	if (Number.isInteger(value)) return formatNumber(value)
	return formatNumber(value, { maximumFractionDigits: 6 })
}

function formatCompactUsd(n: number): string {
	const fractionDigits = Math.abs(n) >= 1_000_000_000 ? 2 : Math.abs(n) >= 1000 ? 1 : undefined
	return formatUsd(n, {
		compact: true,
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	})
}

function formatTick(t: number): string {
	if (t === 0) return '0'
	return formatCompactNumber(t, { maximumFractionDigits: 0 })
}

function niceCeiling(value: number): number {
	if (value <= 0) return 1
	const exponent = Math.floor(Math.log10(value))
	const fraction = value / 10 ** exponent
	let niceFraction: number
	if (fraction <= 1) niceFraction = 1
	else if (fraction <= 2) niceFraction = 2
	else if (fraction <= 2.5) niceFraction = 2.5
	else if (fraction <= 5) niceFraction = 5
	else niceFraction = 10
	return niceFraction * 10 ** exponent
}
