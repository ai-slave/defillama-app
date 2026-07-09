import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { Fragment, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { TOTAL_TRACKED_BY_METRIC_API } from '~/constants'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import defillamaPages from '~/public/pages.json'
import trendingPages from '~/public/trending.json'
import { Button, buttonStyles } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogCanvasSurfaceStyles, dialogScrollableBodyStyles } from '~/ui/Dialog'
import { searchFieldInputStyles } from '~/ui/Input'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { fetchJson } from '~/utils/async'
import { TagGroup } from './TagGroup'
import { Tooltip } from './Tooltip'

interface IPage {
	name: string
	route: string
	description: string
	tags?: string[]
	tab?: string
	totalTrackedKey?: string
}

const trending = [{ category: 'Trending', metrics: trendingPages as Array<IPage> }]

const metricsByCategory = trending.concat(
	Object.entries(
		defillamaPages.Metrics.reduce<Record<string, IPage[]>>((acc, metric) => {
			const category = metric.category || 'Others'
			acc[category] = acc[category] || []
			acc[category].push({
				...metric,
				name: metric.name.includes(': ') ? metric.name.split(': ')[1] : metric.name,
				description: metric.description ?? ''
			})
			return acc
		}, {})
	).map(([category, metrics]: [string, Array<IPage>]) => ({
		category,
		metrics
	}))
)

const TABS = ['All', 'Protocols', 'Chains'] as const
type Tab = (typeof TABS)[number]

const newMetricTagStyles = 'flex items-center gap-1 rounded-md bg-brand px-1.5 py-1 label-xs text-on-brand'

export function Metrics({
	canDismiss = false,
	hasScrolledToCategoryRef
}: {
	canDismiss?: boolean
	hasScrolledToCategoryRef?: React.RefObject<string>
}) {
	const [tab, setTab] = useState<Tab>('All')
	const [searchValue, setSearchValue] = useState('')
	const deferredSearchValue = useDeferredValue(searchValue)

	const router = useRouter()

	const currentCategory =
		router.pathname === '/'
			? null
			: metricsByCategory.find(
					(category) =>
						category.category !== 'Trending' && category.metrics.some((metric) => metric.route === router.pathname)
				)?.category

	const metricsInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (currentCategory && canDismiss) {
			const el = document.querySelector(`[data-category="${currentCategory}"]`)
			if (el && hasScrolledToCategoryRef && hasScrolledToCategoryRef.current !== `${currentCategory}-true`) {
				requestAnimationFrame(() => {
					hasScrolledToCategoryRef.current = `${currentCategory}-true`
					el.scrollIntoView({ behavior: 'smooth', block: 'start' })
				})
			}
		} else if (metricsInputRef.current) {
			requestAnimationFrame(() => {
				metricsInputRef.current?.focus()
			})
		}
	}, [currentCategory, canDismiss, hasScrolledToCategoryRef])

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

	return (
		<div className={canDismiss ? 'flex min-h-0 flex-1 flex-col' : 'contents'}>
			<div
				className={
					canDismiss
						? 'flex flex-col gap-3 p-3'
						: 'flex flex-col gap-3 rounded-[8px] border border-subtle bg-surface p-3'
				}
			>
				<div className="flex items-center gap-2">
					{canDismiss ? <DialogHeading>Metrics</DialogHeading> : <h2 className="heading-sm">Metrics</h2>}
					<TagGroup
						selectedValue={tab}
						setValue={(value) => startTransition(() => setTab(value))}
						values={TABS}
						variant="solid"
						size="sm"
					/>
					{canDismiss ? <DialogCloseButton className="-my-2 ml-auto" ariaLabel="Close metrics" /> : null}
				</div>
				<label className="relative">
					<span className="sr-only">Search pages</span>
					<Icon name="search" height={16} width={16} className="absolute top-0 bottom-0 left-3 my-auto text-tertiary" />
					<input
						ref={metricsInputRef}
						type="text"
						inputMode="search"
						placeholder="Search..."
						className={searchFieldInputStyles}
						onInput={(e) => setSearchValue(e.currentTarget.value)}
					/>
				</label>
				<div className="flex flex-wrap gap-1.5">
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
			</div>
			<div className={`flex flex-col gap-6 ${canDismiss ? `${dialogScrollableBodyStyles} px-3 pb-3` : ''}`}>
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
		</div>
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
	const pinStyle: React.CSSProperties & Record<'--icon-fill', string> = {
		'--icon-fill': isPinned ? 'white' : 'none'
	}

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
			<BasicLink
				className="hover-wash-card col-span-1 flex flex-1 flex-col items-start gap-1.5 rounded-[8px] border border-subtle bg-surface p-3"
				href={page.route}
				target={isExternalLink ? '_blank' : undefined}
				rel={isExternalLink ? 'noopener noreferrer' : undefined}
				onClick={handleClick}
			>
				<span className="flex w-full flex-wrap items-center gap-1">
					<span className="label-md">{page.name}</span>
					{page.tags?.map((tag) =>
						tag === 'Hot' ? (
							<span
								className="flex items-center gap-1 rounded-md bg-[#D24C1F] px-1.5 py-1 label-xs text-white"
								key={`tag-${page.route}-${tag}`}
							>
								<Icon name="flame" height={10} width={10} />
								<span>Hot</span>
							</span>
						) : (
							<span className={newMetricTagStyles} key={`tag-${page.route}-${tag}`}>
								<Icon name="sparkles" height={10} width={10} />
								<span>New</span>
							</span>
						)
					)}
					<Icon name="arrow-right" height={16} width={16} className="ml-auto" />
				</span>
				{totalTrackedByMetric && page.totalTrackedKey ? (
					<span className="body-sm text-link">{getTotalTracked(totalTrackedByMetric, page.totalTrackedKey)}</span>
				) : null}
				<span className="text-start body-md whitespace-pre-wrap text-secondary">{page.description ?? ''}</span>
			</BasicLink>

			<Tooltip
				content={isPinned ? 'Unpin from navigation' : 'Pin to navigation'}
				render={
					<button
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
				className="absolute top-1 right-1 hidden rounded-md bg-brand p-1.5 text-on-brand group-hover:block group-data-[pinned=true]:block"
			>
				<Icon name="pin" height={14} width={14} style={pinStyle} />
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
	const value = totalTrackedKey
		.split('.')
		.reduce<unknown>(
			(obj, key) => (obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined),
			totalTrackedByMetric
		)
	if (!value) return null
	return `${value} tracked`
}

export function MetricsAndTools({ currentMetric }: { currentMetric: Array<string> }) {
	const dialogStore = Ariakit.useDialogStore()
	const hasScrolledToCategoryRef = useRef('')
	const router = useRouter()

	const trackDialogOpen = (trigger: 'pill' | 'browse-search', metric?: string) => {
		trackUmamiEvent('metrics-and-tools-open', {
			page: router.asPath,
			trigger,
			metric
		})
	}

	return (
		<>
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
								backgroundImage: `radial-gradient(circle, color-mix(in srgb, var(--ld-bg-brand) 60%, transparent) 0.8px, transparent 0.8px)`,
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
											className={buttonStyles({ variant: 'metricBrowse', size: 'sm' })}
											onClick={() => trackDialogOpen('pill', metric)}
										>
											{metric}
										</Ariakit.DialogDisclosure>
									)}
								</Fragment>
							))}
						</div>
						<Ariakit.DialogDisclosure
							className="hover-wash flex min-h-6 w-fit items-center gap-1 rounded-md px-1.5 py-1 body-sm text-secondary hover:text-primary focus-visible:text-primary"
							onClick={() => trackDialogOpen('browse-search')}
						>
							<Icon name="search" height={12} width={12} />
							<span className="hidden sm:block">Click to browse & search</span>
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
								backgroundImage: `radial-gradient(circle, color-mix(in srgb, var(--ld-bg-brand) 60%, transparent) 0.8px, transparent 0.8px)`,
								backgroundSize: '3px 3px',
								maskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
								WebkitMaskImage: 'linear-gradient(to left, black 0%, transparent 100%)'
							}}
						/>
					</div>
					<svg width="100%" height="100%" className="absolute top-0 right-0 bottom-0 left-0 z-0 text-divider">
						<defs>
							<linearGradient id="border-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%" style={{ stopColor: 'var(--ld-border-brand)' }} />
								<stop offset="8%" style={{ stopColor: 'var(--ld-border-brand)' }} />
								<stop offset="18%" stopColor="currentColor" />
								<stop offset="82%" stopColor="currentColor" />
								<stop offset="92%" style={{ stopColor: 'var(--ld-border-brand)' }} />
								<stop offset="100%" style={{ stopColor: 'var(--ld-border-brand)' }} />
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
				<Ariakit.Dialog
					className={`${dialogCanvasSurfaceStyles} h-[calc(100dvh-80px)] sm:h-[min(720px,calc(100dvh-32px))] sm:[--dialog-width:min(85vw,1280px)]`}
					unmountOnHide={false}
					hideOnInteractOutside
				>
					<Metrics canDismiss={true} hasScrolledToCategoryRef={hasScrolledToCategoryRef} />
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
		</>
	)
}
