import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { Fragment, startTransition, useDeferredValue, useMemo, useRef, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { TOTAL_TRACKED_BY_METRIC_API } from '~/constants'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import defillamaPages from '~/public/pages.json'
import trendingPages from '~/public/trending.json'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Dialog, DialogBody, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { SearchField } from '~/ui/SearchField'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { fetchJson } from '~/utils/async'

interface IPage {
	name: string
	route: string
	description: string
	tab?: string
	totalTrackedKey?: string
}

const trending = [{ category: 'Trending', metrics: trendingPages as Array<IPage> }]

const metricsByCategoryName: Record<string, Array<IPage>> = {}
for (const metric of defillamaPages.Metrics) {
	const category = metric.category || 'Others'
	const list = (metricsByCategoryName[category] ??= [])
	list.push({
		...metric,
		name: metric.name.includes(': ') ? metric.name.split(': ')[1] : metric.name,
		description: metric.description ?? ''
	})
}
const metricsByCategory = trending.concat(
	Object.entries(metricsByCategoryName).map(([category, metrics]) => ({ category, metrics }))
)

const TAB_OPTIONS = [
	{ value: 'All', label: 'All' },
	{ value: 'Protocols', label: 'Protocols' },
	{ value: 'Chains', label: 'Chains' }
] as const
type Tab = (typeof TAB_OPTIONS)[number]['value']

function findCurrentCategory(pathname: string) {
	if (pathname === '/') return null
	return metricsByCategory.find(
		(category) => category.category !== 'Trending' && category.metrics.some((metric) => metric.route === pathname)
	)?.category
}

export const METRICS_DIRECTORY =
	'A directory of DefiLlama dashboards for TVL, fees, revenue, volume, yields, and stablecoins.'

export function Metrics({
	canDismiss = false,
	searchInputRef
}: {
	canDismiss?: boolean
	searchInputRef?: React.RefObject<HTMLInputElement | null>
}) {
	const [tab, setTab] = useState<Tab>('All')
	const [searchValue, setSearchValue] = useState('')
	const deferredSearchValue = useDeferredValue(searchValue)
	// In the dialog the section grid, nearly all of its nodes, renders in a background pass. A tap that opens the dialog
	// before the page built it paints the header and search at once, and the grid fills in during the open animation.
	const sectionsReady = useDeferredValue(true, !canDismiss)

	const router = useRouter()
	const currentCategory = findCurrentCategory(router.pathname)

	const tabPages = useMemo(() => {
		return metricsByCategory
			.concat(
				canDismiss
					? [
							{
								category: 'Tools',
								metrics: defillamaPages.Tools.map((tool: IPage) => ({
									...tool,
									description: tool.description ?? ''
								}))
							}
						]
					: []
			)
			.map((page) => ({
				category: page.category,
				metrics: page.metrics.filter((metric) => {
					if (tab === 'All') return true
					return metric.tab === tab
				})
			}))
			.filter((page) => page.metrics.length > 0)
	}, [tab, canDismiss])

	const pages = useMemo(() => {
		if (!deferredSearchValue) return tabPages

		return matchSorter(tabPages, deferredSearchValue, {
			keys: ['category', 'metrics.*.name', 'metrics.*.description', 'metrics.*.keys'],
			threshold: matchSorter.rankings.CONTAINS
		}).map((item) => {
			// If the category name matches the search term, show all metrics in that category
			const categoryMatches = item.category.toLowerCase().includes(deferredSearchValue.toLowerCase())

			return {
				...item,
				metrics: categoryMatches
					? item.metrics // Show all metrics if category matches
					: item.metrics.filter(
							(metric) =>
								matchSorter([metric], deferredSearchValue, {
									keys: ['name', 'description', 'keys'],
									threshold: matchSorter.rankings.CONTAINS
								}).length > 0
						)
			}
		})
	}, [deferredSearchValue, tabPages])

	const { data: totalTrackedByMetric } = useQuery({
		queryKey: ['metrics', 'total-tracked'],
		queryFn: () => fetchJson(TOTAL_TRACKED_BY_METRIC_API),
		staleTime: 60 * 60 * 1000
	})

	const pinnedRoutes = usePinnedRoutes()

	const search = (
		<SearchField
			label="Search pages"
			ref={searchInputRef}
			placeholder="Search…"
			value={searchValue}
			onChange={setSearchValue}
		/>
	)
	const tabs = (
		<SegmentedControl
			value={tab}
			onValueChange={(value) => startTransition(() => setTab(value))}
			options={TAB_OPTIONS}
			label="Metric scope"
			variant="solid"
			size="sm"
		/>
	)
	const categoryJumps = (
		// One scrolling row on a phone, so the jumps never push the metrics below the fold; they wrap from sm.
		<div
			className={`flex [scrollbar-width:none] gap-1.5 overflow-x-auto sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${canDismiss ? '-mx-4 px-4' : '-mx-3 px-3'}`}
		>
			{pages.map(({ category }) => (
				<Button
					size="sm"
					variant="filter"
					key={category}
					data-active={category === currentCategory}
					onClick={() => {
						const element = document.querySelector(`[data-category="${category}"]`)
						if (element) {
							element.scrollIntoView({ behavior: 'smooth', block: 'start' })
						}
					}}
				>
					{category}
				</Button>
			))}
		</div>
	)
	const sections = (
		<div className="flex flex-col gap-6">
			{pages.map(({ category, metrics }) => (
				<div key={category} className="relative flex flex-col gap-3">
					<div className="absolute -top-4" data-category={category} />
					<div className="flex flex-row items-center gap-2">
						<h2 className="heading-xs">{category}</h2>
						<hr className="flex-1 border-subtle" />
					</div>
					<div
						className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${canDismiss ? 'lg:grid-cols-3 xl:grid-cols-4' : 'xl:grid-cols-3 2xl:grid-cols-4'}`}
					>
						{metrics.map((metric) => (
							<LinkToMetricOrToolPage
								key={`metric-${metric.name}-${metric.route}`}
								page={metric}
								totalTrackedByMetric={totalTrackedByMetric}
								pinnedRoutes={pinnedRoutes}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	)

	if (canDismiss) {
		return (
			<>
				<DialogHeader title="Metrics" />
				<DialogToolbar>
					<div className="flex flex-col gap-3">
						<div className="flex flex-wrap items-center gap-2 *:first:min-w-0 *:first:flex-1">
							{search}
							{tabs}
						</div>
						{categoryJumps}
					</div>
				</DialogToolbar>
				<DialogBody>{sectionsReady ? sections : null}</DialogBody>
			</>
		)
	}

	return (
		<>
			<Card padding="base" className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<h1 className="heading-sm">DeFi metrics</h1>
						{tabs}
					</div>
					<p className="body-sm text-secondary">{METRICS_DIRECTORY}</p>
				</div>
				{search}
				{categoryJumps}
			</Card>
			{sections}
		</>
	)
}

export function LinkToMetricOrToolPage({
	page,
	totalTrackedByMetric,
	pinnedRoutes
}: {
	page: IPage
	totalTrackedByMetric: Record<string, unknown> | undefined
	pinnedRoutes: Set<string>
}) {
	const isPinned = pinnedRoutes.has(page.route)

	const dialogStore = Ariakit.useDialogContext()

	const isExternalLink = page.route.startsWith('http')
	const isCurrentPage = useRouter().pathname === page.route

	const handleClick = (e: React.MouseEvent) => {
		if (isCurrentPage && dialogStore && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
			e.preventDefault()
			dialogStore.hide()
		}
	}

	return (
		<div
			className={`relative col-span-1 flex min-h-[120px] flex-col ${page.route === '/' ? '' : 'group'}`}
			style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 120px' }}
			data-pinned={isPinned}
		>
			<Card
				as={BasicLink}
				padding="base"
				className="hover-wash-card flex flex-1 flex-col items-start gap-1.5"
				href={page.route}
				target={isExternalLink ? '_blank' : undefined}
				rel={isExternalLink ? 'noopener noreferrer' : undefined}
				onClick={handleClick}
			>
				<span className="flex w-full flex-wrap items-center gap-1">
					<span className="label-md">{page.name}</span>
					{/* The pin shows in this corner on hover, keyboard focus, touch and once pinned; the arrow steps aside for it. */}
					<Icon
						name="arrow-right"
						className="ml-auto size-4 group-hover:invisible group-has-focus-visible:invisible group-data-[pinned=true]:invisible pointer-coarse:invisible"
					/>
				</span>
				{totalTrackedByMetric && page.totalTrackedKey ? (
					<span className="body-sm text-link">{getTotalTracked(totalTrackedByMetric, page.totalTrackedKey)}</span>
				) : null}
				<span className="text-start body-md whitespace-pre-wrap text-secondary">{page.description ?? ''}</span>
			</Card>

			<Tooltip
				content={isPinned ? 'Unpin from navigation' : 'Pin to navigation'}
				render={
					<Button
						// Shown on hover, on keyboard focus inside the card, and always on touch, which has no hover. Only a
						// pinned page is a brand square, so a grid of cards on touch is not a grid of brand squares.
						variant={isPinned ? 'primary' : 'ghost'}
						size="sm"
						square
						className="invisible absolute top-1 right-1 group-hover:visible group-has-focus-visible:visible group-data-[pinned=true]:visible pointer-coarse:visible"
						aria-label={isPinned ? 'Unpin from navigation' : 'Pin to navigation'}
						onClick={(e) => {
							const currentPinnedMetrics = JSON.parse(window.localStorage.getItem('pinned-metrics') || '[]')
							setStorageItem(
								'pinned-metrics',
								JSON.stringify(
									currentPinnedMetrics.includes(page.route)
										? currentPinnedMetrics.filter((metric: string) => metric !== page.route)
										: [...currentPinnedMetrics, page.route]
								)
							)
							e.preventDefault()
							e.stopPropagation()
						}}
					/>
				}
			>
				<Icon name="pin" className={isPinned ? 'size-4 fill-current' : 'size-4'} />
			</Tooltip>
		</div>
	)
}

export function usePinnedRoutes(): Set<string> {
	const raw = useStorageItem('pinned-metrics', '[]')
	return useMemo(() => {
		let arr: unknown
		try {
			arr = JSON.parse(raw)
		} catch {
			return new Set<string>()
		}
		return new Set<string>(Array.isArray(arr) ? arr : [])
	}, [raw])
}

const getTotalTracked = (totalTrackedByMetric: Record<string, unknown>, totalTrackedKey: string): string | null => {
	let value: unknown = totalTrackedByMetric
	for (const key of totalTrackedKey.split('.')) {
		value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
	}
	if (!value) return null
	return `${value} tracked`
}

export function MetricsAndTools({ currentMetric }: { currentMetric: Array<string> }) {
	const dialogStore = Ariakit.useDialogStore()
	// The closed dialog keeps its state between opens, so its ~1,300 nodes are built once, in a background render
	// after hydration instead of inside it. A tap before that render finishes builds the header at once.
	const open = Ariakit.useStoreState(dialogStore, 'open')
	const contentReady = useDeferredValue(true, false) || open
	const searchInputRef = useRef<HTMLInputElement>(null)
	const scrolledToCategoryRef = useRef<string | null>(null)
	const router = useRouter()
	const currentCategory = findCurrentCategory(router.pathname)

	const trackDialogOpen = (trigger: 'pill' | 'browse-search', metric?: string) => {
		trackUmamiEvent('metrics-and-tools-open', {
			page: router.asPath,
			trigger,
			metric
		})
	}

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<div className="relative isolate w-full rounded-md bg-surface p-1">
				{/* Left decorative dot pattern */}
				<div
					className="pointer-events-none absolute top-px left-px h-[calc(100%-2px)] w-16 overflow-hidden rounded-l-[6px] sm:w-24 md:w-48"
					aria-hidden="true"
				>
					<div
						className="absolute inset-0"
						style={{
							backgroundImage: `radial-gradient(circle, color-mix(in srgb, var(--bg-brand) 60%, transparent) 0.8px, transparent 0.8px)`,
							backgroundSize: '3px 3px',
							maskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
							WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 100%)'
						}}
					/>
				</div>
				<div className="relative z-10 flex min-h-6 flex-wrap items-center justify-center gap-1">
					<div className="flex min-w-0 flex-wrap items-center justify-center gap-1">
						{currentMetric.map((metric, i) => (
							<Fragment key={`metric-name-${metric}`}>
								{i === 1 ? (
									<span>{metric}</span>
								) : (
									<Ariakit.DialogDisclosure
										render={<Button variant="metricBrowse" size="sm" />}
										onClick={() => trackDialogOpen('pill', metric)}
									>
										{metric}
									</Ariakit.DialogDisclosure>
								)}
							</Fragment>
						))}
					</div>
					<Ariakit.DialogDisclosure
						render={<Button variant="ghost" size="sm" className="w-fit" />}
						onClick={() => trackDialogOpen('browse-search')}
					>
						<Icon name="search" className="size-3.5" />
						<span className="max-sm:sr-only">Click to browse & search</span>
					</Ariakit.DialogDisclosure>
				</div>
				{/* Right decorative dot pattern */}
				<div
					className="pointer-events-none absolute top-px right-px h-[calc(100%-2px)] w-16 overflow-hidden rounded-r-[6px] sm:w-24 md:w-48"
					aria-hidden="true"
				>
					<div
						className="absolute inset-0"
						style={{
							backgroundImage: `radial-gradient(circle, color-mix(in srgb, var(--bg-brand) 60%, transparent) 0.8px, transparent 0.8px)`,
							backgroundSize: '3px 3px',
							maskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
							WebkitMaskImage: 'linear-gradient(to left, black 0%, transparent 100%)'
						}}
					/>
				</div>
				<svg width="100%" height="100%" className="absolute top-0 right-0 bottom-0 left-0 z-0">
					<defs>
						<linearGradient id="border-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
							<stop offset="0%" style={{ stopColor: 'var(--border-brand)' }} />
							<stop offset="8%" style={{ stopColor: 'var(--border-brand)' }} />
							<stop offset="18%" style={{ stopColor: 'var(--border-brand)', stopOpacity: 0 }} />
							<stop offset="82%" style={{ stopColor: 'var(--border-brand)', stopOpacity: 0 }} />
							<stop offset="92%" style={{ stopColor: 'var(--border-brand)' }} />
							<stop offset="100%" style={{ stopColor: 'var(--border-brand)' }} />
						</linearGradient>
					</defs>
					<rect
						x="1"
						y="1"
						width="calc(100% - 1.5px)"
						height="calc(100% - 1.5px)"
						rx="6"
						ry="6"
						fill="none"
						stroke="url(#border-gradient)"
						strokeWidth="1"
					/>
				</svg>
			</div>
			<Dialog
				size="xl"
				workspace
				canvas
				// Keep the selected tab, search query, and category scroll position when reopening.
				unmountOnHide={false}
				hideOnInteractOutside
				// A metric page keeps Ariakit's default focus so the phone keyboard stays down; other pages focus search.
				initialFocus={currentCategory ? undefined : searchInputRef}
				autoFocusOnShow={() => {
					// Only the first open scrolls to the page's category; later opens keep the reader's scroll.
					if (currentCategory && scrolledToCategoryRef.current !== currentCategory) {
						// Opened before its grid was built, the dialog has nothing to scroll to yet; the next open does it.
						const target = dialogStore.getState().contentElement!.querySelector(`[data-category="${currentCategory}"]`)
						if (target) {
							scrolledToCategoryRef.current = currentCategory
							target.scrollIntoView({ behavior: 'smooth', block: 'start' })
						}
					}
					return true
				}}
			>
				{contentReady ? <Metrics canDismiss searchInputRef={searchInputRef} /> : null}
			</Dialog>
		</Ariakit.DialogProvider>
	)
}
