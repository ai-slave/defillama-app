import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { ViewTabs } from '~/components/ViewTabs'
import { TrialCsvLimitModal } from '~/containers/Subscription/shared/TrialCsvLimitModal'
import { useRecentDownloads, useSavedDownloads } from '~/contexts/LocalStorage'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { passFocusOnLeave } from '~/ui/focus'
import { Icon, type IIcon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { RelativeTime } from '~/ui/RelativeTime'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import {
	chartDatasets,
	chartDatasetCategories,
	chartDatasetsBySlug,
	type ChartDatasetDefinition,
	type ChartOptionsMap
} from './chart-datasets'
import { ChartDatasetModal } from './ChartDatasetModal'
import { DatasetPreviewModal } from './DatasetPreviewModal'
import { datasets, datasetCategories, datasetsBySlug, type DatasetDefinition } from './datasets'
import { MultiMetricModal } from './MultiMetricModal'
import { DeletePresetDialog, RenamePresetDialog } from './PresetDialogs'
import {
	type ChartSavedConfig,
	type DatasetSavedConfig,
	describeSavedConfig,
	type MultiMetricSavedConfig,
	type SavedDownload
} from './savedDownloads'
import { decodeDownloadConfig, encodeDownloadConfig } from './urlState'

const ALL_TABS = [
	{ id: 'datasets', label: 'Datasets' },
	{ id: 'time-series', label: 'Time Series' },
	{ id: 'saved', label: 'Saved' }
] as const
const TAB_VALUES = ALL_TABS.map((tab) => tab.id)
type CatalogTab = (typeof TAB_VALUES)[number]

const ALL_CATEGORY = 'All'

type DownloadGroup<T extends { category: string; description: string; name: string }> = {
	category: string
	items: Array<T>
}

const ALL_DATASETS_BY_CATEGORY = datasetCategories.map((category) => ({
	category,
	items: datasets.filter((dataset) => dataset.category === category)
}))

const ALL_CHARTS_BY_CATEGORY = chartDatasetCategories.map((category) => ({
	category,
	items: chartDatasets.filter((dataset) => dataset.category === category)
}))

function filterDownloadGroups<T extends { category: string; description: string; name: string }>(
	groups: Array<DownloadGroup<T>>,
	search: string
) {
	const query = search.toLowerCase()
	const filteredGroups: Array<DownloadGroup<T>> = []
	for (const group of groups) {
		if (group.category.toLowerCase().includes(query)) {
			filteredGroups.push(group)
			continue
		}

		const matched = matchSorter(group.items, search, {
			keys: ['name', 'description', 'category'],
			threshold: matchSorter.rankings.CONTAINS
		})
		if (matched.length > 0) filteredGroups.push({ ...group, items: matched })
	}
	return filteredGroups
}

type CatalogView =
	| { kind: 'dataset'; dataset: DatasetDefinition; config?: DatasetSavedConfig }
	| { kind: 'chart'; dataset: ChartDatasetDefinition; config?: ChartSavedConfig }
	| { kind: 'multiMetric'; config?: MultiMetricSavedConfig }
	| { kind: 'trialLimit' }

// What a saved preset or a shared link opens. Null for a SQL query, which the SQL workspace opens, and when its
// dataset no longer exists.
function viewForConfig(config: SavedDownload, isTrialAccount: boolean): CatalogView | null {
	if (isTrialAccount) return { kind: 'trialLimit' }
	if (config.kind === 'query') return null
	if (config.kind === 'multiMetric') return { kind: 'multiMetric', config }
	if (config.kind === 'chart') {
		const dataset = chartDatasetsBySlug.get(config.slug)
		return dataset ? { kind: 'chart', dataset, config } : null
	}
	const dataset = datasetsBySlug.get(config.slug)
	return dataset ? { kind: 'dataset', dataset, config } : null
}

export function DownloadsCatalog({ chartOptionsMap }: { chartOptionsMap: ChartOptionsMap }) {
	const { isAuthenticated, hasActiveSubscription, isTrial, loaders, authorizedFetch } = useAuthContext()
	const { savedDownloads, deleteDownload, renameDownload } = useSavedDownloads()
	const { recentDownloads, clearRecents } = useRecentDownloads()
	const [activeTab, setActiveTab] = useState<CatalogTab>('datasets')
	// What a card, a preset or the combine button opened. Only one shows at a time: each dialog covers the catalog.
	const [opened, setOpened] = useState<CatalogView | null>(null)

	const [searchValue, setSearchValue] = useState('')
	const deferredSearch = useDeferredValue(searchValue)
	const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY)

	const isPreview = !isAuthenticated || !hasActiveSubscription

	const filteredDatasetsByCategory = useMemo(() => {
		let grouped = ALL_DATASETS_BY_CATEGORY
		if (selectedCategory !== ALL_CATEGORY) {
			grouped = grouped.filter((g) => g.category === selectedCategory)
		}
		if (!deferredSearch) return grouped
		return filterDownloadGroups(grouped, deferredSearch)
	}, [deferredSearch, selectedCategory])

	const filteredChartsByCategory = useMemo(() => {
		let grouped = ALL_CHARTS_BY_CATEGORY
		if (selectedCategory !== ALL_CATEGORY) {
			grouped = grouped.filter((g) => g.category === selectedCategory)
		}
		if (!deferredSearch) return grouped
		return filterDownloadGroups(grouped, deferredSearch)
	}, [deferredSearch, selectedCategory])

	const totalFilteredCount = useMemo(() => {
		const groups = activeTab === 'datasets' ? filteredDatasetsByCategory : filteredChartsByCategory
		return groups.reduce((sum, g) => sum + g.items.length, 0)
	}, [activeTab, filteredDatasetsByCategory, filteredChartsByCategory])

	const totalCount = activeTab === 'datasets' ? datasets.length : chartDatasets.length

	const currentCategories = activeTab === 'datasets' ? datasetCategories : chartDatasetCategories

	const categoryCounts = useMemo(() => {
		const groups = activeTab === 'datasets' ? ALL_DATASETS_BY_CATEGORY : ALL_CHARTS_BY_CATEGORY
		const counts: Record<string, number> = {}
		for (const g of groups) {
			counts[g.category] = g.items.length
		}
		return counts
	}, [activeTab])

	const openCard = (next: CatalogView) =>
		setOpened(isAuthenticated && hasActiveSubscription && isTrial ? { kind: 'trialLimit' } : next)

	const handleRunPreset = useCallback(
		(preset: SavedDownload) => {
			const view = viewForConfig(preset, isAuthenticated && hasActiveSubscription && isTrial)
			if (view) setOpened(view)
			// Query presets open the SQL workspace — handled at the router level.
			else if (preset.kind === 'query') toast.error('Saved SQL query — switch to SQL mode to run it.')
			else if (preset.kind !== 'multiMetric') {
				toast.error(`${preset.kind === 'chart' ? 'Chart' : 'Dataset'} "${preset.slug}" no longer available`)
			}
			// lastRunAt is bumped inside recordRecent when the download actually completes.
		},
		[isAuthenticated, hasActiveSubscription, isTrial]
	)

	// A shared link opens its preview from the URL, which holds it until the preview closes. The pages router fills
	// the query only after hydration, and the trial check waits for the account, which reads as signed out until the
	// hydration render is over. SQL links carry mode=sql, so the SQL workspace opens those.
	const router = useRouter()
	const isClient = useIsClient()
	const isAccountLoading = loaders.userLoading || loaders.subscriptionInitialCheck
	const sharedConfig = isClient && router.isReady && !isAccountLoading ? decodeDownloadConfig(router.query) : null
	const linkedView = sharedConfig
		? viewForConfig(
				// The modals key on the id and never read the name.
				{ ...sharedConfig, id: 'shared-link', name: '', createdAt: 0 },
				isAuthenticated && hasActiveSubscription && isTrial
			)
		: null
	const view = opened ?? linkedView
	const closeView = () => {
		if (opened) {
			setOpened(null)
			return
		}
		// Drop exactly the params the link writer set.
		const nextQuery = { ...router.query }
		for (const key in encodeDownloadConfig(sharedConfig!)) delete nextQuery[key]
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}

	const isUserLoading = loaders.userLoading

	return (
		<Tabs
			value={activeTab}
			values={TAB_VALUES}
			onValueChange={(tab) => {
				setActiveTab(tab)
				setSelectedCategory(ALL_CATEGORY)
			}}
		>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-1">
					<h1 className="heading-lg">Downloads</h1>
					<p className="body-md text-secondary">
						Download CSV datasets from DefiLlama. Click a dataset to preview and choose columns.
					</p>
				</div>

				{recentDownloads.length > 0 ? (
					<RecentDownloadsStrip recents={recentDownloads} onRun={handleRunPreset} onClear={clearRecents} />
				) : null}

				<ViewTabs tabs={ALL_TABS} label="Download type" />

				<TabPanel value={activeTab} className="flex min-w-0 flex-col gap-6">
					{activeTab !== 'saved' ? (
						<label className="relative">
							<span className="sr-only">Search datasets</span>
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
							<Input
								type="text"
								inputMode="search"
								value={searchValue}
								placeholder="Search…"
								onInput={(e) => setSearchValue(e.currentTarget.value)}
								className={searchFieldInputPlacementStyles}
							/>
						</label>
					) : null}

					{activeTab !== 'saved' ? (
						<SegmentedControl
							label="Dataset categories"
							variant="chips"
							size="md"
							value={selectedCategory}
							onValueChange={setSelectedCategory}
							options={[
								{ value: ALL_CATEGORY, label: <CategoryLabel name="All" count={totalCount} /> },
								...currentCategories.map((category) => ({
									value: category,
									label: <CategoryLabel name={category} count={categoryCounts[category] ?? 0} />
								}))
							]}
						/>
					) : null}

					{activeTab !== 'saved' && (deferredSearch || selectedCategory !== ALL_CATEGORY) && (
						<p className="body-sm text-tertiary">
							Showing {totalFilteredCount} of {totalCount} datasets
							{selectedCategory !== ALL_CATEGORY ? ` in ${selectedCategory}` : ''}
							{deferredSearch ? ` matching "${deferredSearch}"` : ''}
						</p>
					)}

					{activeTab === 'datasets' ? (
						<div className="flex flex-col gap-8">
							{filteredDatasetsByCategory.map(({ category, items }) => (
								<section key={category} className="flex flex-col gap-3">
									<h2 className="heading-xs text-primary">{category}</h2>
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										{items.map((dataset) => {
											const disabled = !!isUserLoading
											return (
												<button
													key={dataset.slug}
													type="button"
													disabled={disabled}
													onClick={() => openCard({ kind: 'dataset', dataset })}
													className="group flex cursor-pointer touch-manipulation flex-col gap-3 rounded-xl border border-subtle p-5 text-left transition-all duration-150 hover:border-brand-muted hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
												>
													<div className="flex items-start justify-between gap-3">
														<div className="flex items-center gap-3">
															<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
																{disabled ? (
																	<LoadingSpinner size={18} />
																) : (
																	<Icon name="file-text" className="size-5 text-link" />
																)}
															</div>
															<span className="font-medium text-link group-hover:underline">{dataset.name}</span>
														</div>
														<Icon
															name="arrow-up-right"
															className="mt-0.5 size-4 shrink-0 text-secondary transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-link"
														/>
													</div>
													<p className="body-md text-secondary">{dataset.description}</p>
												</button>
											)
										})}
									</div>
								</section>
							))}
							{filteredDatasetsByCategory.length === 0 && (
								<p className="py-8 text-center body-md text-tertiary">No datasets match your search.</p>
							)}
						</div>
					) : activeTab === 'time-series' ? (
						<div className="flex flex-col gap-8">
							<button
								type="button"
								onClick={() => {
									setOpened(isTrial ? { kind: 'trialLimit' } : { kind: 'multiMetric' })
								}}
								className="group relative flex items-start justify-between gap-4 overflow-hidden rounded-xl border border-brand-muted bg-linear-to-br from-brand-faint to-transparent p-4 text-left transition-all hover:border-brand-strong"
							>
								<div className="flex items-start gap-3">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint-strong">
										<Icon name="layers" className="size-5 text-link" />
									</div>
									<div className="flex flex-col gap-0.5">
										<p className="font-medium text-primary">Combine multiple metrics</p>
										<p className="body-md text-secondary">
											Pick a protocol or chain, mix any of its metrics — TVL, fees, volume, revenue — into a single CSV.
										</p>
									</div>
								</div>
								<span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-md bg-brand px-2.5 py-1 label-sm text-on-brand shadow-sm transition-transform group-hover:translate-x-0.5">
									Open builder
									<Icon name="arrow-up-right" className="size-3.5" />
								</span>
							</button>

							{filteredChartsByCategory.map(({ category, items }) => (
								<section key={`chart-${category}`} className="flex flex-col gap-3">
									<h2 className="heading-xs text-primary">{category}</h2>
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
										{items.map((dataset) => {
											const disabled = !!isUserLoading
											return (
												<button
													key={dataset.slug}
													type="button"
													disabled={disabled}
													onClick={() => openCard({ kind: 'chart', dataset })}
													className="group flex cursor-pointer touch-manipulation flex-col gap-3 rounded-xl border border-subtle p-5 text-left transition-all duration-150 hover:border-brand-muted hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
												>
													<div className="flex items-start justify-between gap-3">
														<div className="flex items-center gap-3">
															<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
																{disabled ? (
																	<LoadingSpinner size={18} />
																) : (
																	<Icon name="bar-chart-2" className="size-5 text-link" />
																)}
															</div>
															<span className="font-medium text-link group-hover:underline">{dataset.name}</span>
														</div>
														<Icon
															name="arrow-up-right"
															className="mt-0.5 size-4 shrink-0 text-secondary transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-link"
														/>
													</div>
													<p className="body-md text-secondary">{dataset.description}</p>
													<span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-elevated-1 px-2 py-0.5 body-sm text-tertiary">
														Select {dataset.paramLabel}
													</span>
												</button>
											)
										})}
									</div>
									{category === 'RWA' ? (
										<p className="body-md text-secondary">
											Download more RWA data from the{' '}
											<a href="https://defillama.com/rwa" className="text-link underline">
												RWA overview
											</a>
											.
										</p>
									) : null}
								</section>
							))}
							{filteredChartsByCategory.length === 0 && (
								<p className="py-8 text-center body-md text-tertiary">No datasets match your search.</p>
							)}
						</div>
					) : (
						<SavedDownloadsContent
							savedDownloads={savedDownloads}
							onRun={handleRunPreset}
							onRename={renameDownload}
							onDelete={deleteDownload}
						/>
					)}
				</TabPanel>

				{view?.kind === 'multiMetric' ? (
					// Keyed by the saved config so opening a different preset builds a fresh modal rather than
					// resetting the one on screen.
					<MultiMetricModal
						key={view.config?.id ?? 'new'}
						chartOptionsMap={chartOptionsMap}
						authorizedFetch={authorizedFetch}
						isPreview={isPreview}
						initialConfig={view.config}
						onClose={closeView}
					/>
				) : null}

				{view?.kind === 'chart' ? (
					// Keyed by what the modal is showing: running a different saved preset while it is open
					// builds a fresh modal instead of resetting the one on screen.
					<ChartDatasetModal
						key={`${view.dataset.slug}:${view.config?.id ?? 'new'}`}
						dataset={view.dataset}
						options={chartOptionsMap[view.dataset.slug] ?? []}
						authorizedFetch={authorizedFetch}
						onClose={closeView}
						isTrial={isTrial}
						isPreview={isPreview}
						initialConfig={view.config}
					/>
				) : null}

				{view?.kind === 'dataset' ? (
					// Keyed by what the modal is showing, as above.
					<DatasetPreviewModal
						key={`${view.dataset.slug}:${view.config?.id ?? 'new'}`}
						dataset={view.dataset}
						authorizedFetch={authorizedFetch}
						onClose={closeView}
						isTrial={isTrial}
						isPreview={isPreview}
						initialConfig={view.config}
					/>
				) : null}

				{view?.kind === 'trialLimit' ? <TrialCsvLimitModal isOpen onClose={closeView} /> : null}

				<section className="mt-8 flex flex-col gap-4 border-t border-subtle pt-8">
					<h2 className="heading-xs text-primary">FAQ</h2>
					<div className="divide-y divide-(--border-subtle) border-y border-subtle">
						<FaqItem question="How do I subscribe to download data from DefiLlama?">
							DefiLlama data is available to subscribers of our Pro and API plans. Learn more about these plans on the{' '}
							<a
								href="https://defillama.com/subscription"
								className="text-link underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								subscription page
							</a>
							.
						</FaqItem>
						<FaqItem question="Is DefiLlama data available through an API?">
							Yes, DefiLlama data is available through both a free and paid{' '}
							<a
								href="https://api-docs.defillama.com/"
								className="text-link underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								API
							</a>
							.
						</FaqItem>
						<FaqItem question="How can I contact DefiLlama with questions?">
							You can contact us by email, a support form, or live support on the{' '}
							<a
								href="https://defillama.com/support"
								className="text-link underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								support page
							</a>
							.
						</FaqItem>
					</div>
				</section>
			</div>
		</Tabs>
	)
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
	return (
		<details className="group">
			<summary className="flex cursor-pointer items-center gap-4 py-4">
				<span className="flex-1 label-md text-primary">{question}</span>
				<Icon
					name="chevron-down"
					height={16}
					width={16}
					className="shrink-0 text-secondary transition-transform duration-200 group-open:rotate-180"
				/>
			</summary>
			<div className="pb-4 body-md text-secondary">{children}</div>
		</details>
	)
}

function kindIcon(kind: SavedDownload['kind']): IIcon['name'] {
	if (kind === 'dataset') return 'file-text'
	if (kind === 'chart') return 'bar-chart-2'
	if (kind === 'query') return 'code'
	return 'layers'
}

// Collapse the SavedDownload kinds into visual buckets:
// - dataset: flat tabular exports
// - timeseries: chart + multiMetric (both produce date-indexed CSVs)
// - query: SQL workspace presets
type KindBucket = 'dataset' | 'timeseries' | 'query'

interface KindStyle {
	label: string
	accent: string
	fg: string
}

const KIND_STYLES: Record<KindBucket, KindStyle> = {
	dataset: {
		label: 'Dataset',
		accent: 'bg-brand',
		fg: 'text-link'
	},
	timeseries: {
		label: 'Time series',
		accent: 'bg-pro-ai',
		fg: 'text-pro-ai-text'
	},
	query: {
		label: 'SQL query',
		accent: 'bg-success',
		fg: 'text-success'
	}
}

function kindBucket(kind: SavedDownload['kind']): KindBucket {
	if (kind === 'dataset') return 'dataset'
	if (kind === 'query') return 'query'
	return 'timeseries'
}

function kindStyle(kind: SavedDownload['kind']): KindStyle {
	return KIND_STYLES[kindBucket(kind)]
}

function resolvedLabel(preset: SavedDownload): string {
	if (preset.kind === 'dataset') return datasetsBySlug.get(preset.slug)?.name ?? preset.slug
	if (preset.kind === 'chart') return chartDatasetsBySlug.get(preset.slug)?.name ?? preset.slug
	if (preset.kind === 'query') return 'SQL workspace'
	return preset.paramLabel ?? preset.param
}

// Clear all removes the strip with it; the selected download type tab, its sibling below, takes focus.
const focusTypeTabOnLeave = passFocusOnLeave((node) =>
	node.closest('section')?.parentElement?.querySelector<HTMLElement>('[role="tablist"] [aria-selected="true"]')
)

function RecentDownloadsStrip({
	recents,
	onRun,
	onClear
}: {
	recents: Array<SavedDownload>
	onRun: (preset: SavedDownload) => void
	onClear: () => void
}) {
	const items = recents.slice(0, 8)
	return (
		<section aria-label="Recent downloads" className="flex flex-col gap-2">
			<header className="flex items-baseline justify-between gap-3 px-0.5 label-sm">
				<div className="flex items-baseline gap-2">
					<Icon name="clock" className="size-3 self-center text-tertiary" />
					<h2 className="tracking-wider text-tertiary uppercase">Recent</h2>
					<span className="text-tertiary">{items.length === 1 ? '1 run' : `${items.length} runs`}</span>
				</div>
				<Button ref={focusTypeTabOnLeave} variant="link" onClick={onClear}>
					Clear all
				</Button>
			</header>
			<div className="flex overflow-x-auto border-y border-subtle">
				<ul className="flex min-w-full gap-0">
					{items.map((preset, i) => {
						const style = kindStyle(preset.kind)
						return (
							<li
								key={preset.id}
								className="flex shrink-0 border-l border-subtle first:border-l-0"
								style={{ width: 'clamp(200px, 22%, 260px)' }}
							>
								<button
									type="button"
									onClick={() => onRun(preset)}
									className="group relative flex min-w-0 flex-1 flex-col gap-1 py-2.5 pr-3 pl-4 text-left transition-colors hover:bg-hover-row focus-visible:bg-hover-row"
								>
									<span
										className={`absolute top-3 bottom-3 left-2 w-0.5 rounded-full ${style.accent} opacity-40 transition-opacity group-hover:opacity-100`}
										aria-hidden="true"
									/>
									<span className="flex items-center gap-1.5">
										<span className={`inline-flex items-center gap-1 label-xs tracking-wider uppercase ${style.fg}`}>
											<Icon name={kindIcon(preset.kind)} className="size-3" />
											{style.label}
										</span>
										{i === 0 ? (
											<span className="ml-auto rounded-sm bg-brand-tint-strong px-1 py-px label-sm tracking-wide text-link uppercase">
												New
											</span>
										) : null}
									</span>
									<span className="truncate label-sm text-primary">{preset.name}</span>
									<span className="flex items-center justify-between gap-2 label-sm text-tertiary tabular-nums">
										<RelativeTime className="truncate" value={preset.createdAt} input="milliseconds" />
										<Icon
											name="arrow-up-right"
											className="size-3 shrink-0 -translate-x-1 text-tertiary opacity-0 transition-all group-hover:translate-x-0 group-hover:text-link group-hover:opacity-100"
										/>
									</span>
								</button>
							</li>
						)
					})}
				</ul>
			</div>
		</section>
	)
}

function CategoryLabel({ name, count }: { name: string; count: number }) {
	return (
		<>
			{name} <span className="text-tertiary tabular-nums">{count}</span>
		</>
	)
}

function SavedDownloadsContent({
	savedDownloads,
	onRun,
	onRename,
	onDelete
}: {
	savedDownloads: Array<SavedDownload>
	onRun: (preset: SavedDownload) => void
	onRename: (id: string, name: string) => void
	onDelete: (id: string) => void
}) {
	const [renamingPreset, setRenamingPreset] = useState<SavedDownload | null>(null)
	const [deletingPreset, setDeletingPreset] = useState<SavedDownload | null>(null)

	const bucketCounts = useMemo(() => {
		let dataset = 0
		let timeseries = 0
		let query = 0
		for (const p of savedDownloads) {
			if (p.kind === 'dataset') dataset++
			else if (p.kind === 'query') query++
			else timeseries++
		}
		return { dataset, timeseries, query }
	}, [savedDownloads])

	if (savedDownloads.length === 0) {
		return <SavedEmptyState />
	}

	return (
		<>
			<div className="flex items-baseline justify-between gap-3 px-0.5">
				<p className="title-sm tracking-[0.14em] text-tertiary uppercase">
					{savedDownloads.length} {savedDownloads.length === 1 ? 'preset' : 'presets'}
				</p>
				<p className="flex items-center gap-3 body-sm text-tertiary tabular-nums">
					{bucketCounts.dataset > 0 ? (
						<span className="flex items-center gap-1.5">
							<span className={`size-1.5 rounded-full ${KIND_STYLES.dataset.accent}`} aria-hidden="true" />
							{bucketCounts.dataset} dataset{bucketCounts.dataset === 1 ? '' : 's'}
						</span>
					) : null}
					{bucketCounts.timeseries > 0 ? (
						<span className="flex items-center gap-1.5">
							<span className={`size-1.5 rounded-full ${KIND_STYLES.timeseries.accent}`} aria-hidden="true" />
							{bucketCounts.timeseries} time series
						</span>
					) : null}
					{bucketCounts.query > 0 ? (
						<span className="flex items-center gap-1.5">
							<span className={`size-1.5 rounded-full ${KIND_STYLES.query.accent}`} aria-hidden="true" />
							{bucketCounts.query} SQL quer{bucketCounts.query === 1 ? 'y' : 'ies'}
						</span>
					) : null}
				</p>
			</div>
			<ul className="-mx-1 border-y border-subtle">
				{savedDownloads.map((preset) => (
					<SavedDownloadRow
						key={preset.id}
						preset={preset}
						onRun={onRun}
						onRenameRequest={setRenamingPreset}
						onDeleteRequest={setDeletingPreset}
					/>
				))}
			</ul>
			{renamingPreset ? (
				<RenamePresetDialog
					preset={renamingPreset}
					presets={savedDownloads}
					onRename={onRename}
					onClose={() => setRenamingPreset(null)}
				/>
			) : null}
			{deletingPreset ? (
				<DeletePresetDialog preset={deletingPreset} onDelete={onDelete} onClose={() => setDeletingPreset(null)} />
			) : null}
		</>
	)
}

function SavedEmptyState() {
	return (
		<div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-subtle px-6 py-12 text-center">
			<div className="flex size-14 items-center justify-center rounded-full bg-brand-tint text-link">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.75"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="size-7"
					aria-hidden="true"
				>
					<path d="M6 3h12v18l-6-4-6 4z" />
				</svg>
			</div>
			<div className="flex flex-col gap-1.5">
				<h3 className="title-lg text-primary">Pin your first preset</h3>
				<p className="max-w-sm body-md text-secondary">
					Save any dataset or chart configuration to run it again from here.
				</p>
			</div>
			<p className="body-sm text-tertiary">
				Open a dataset, tweak your columns and filters, then click{' '}
				<span className="inline-flex items-center gap-1 rounded-sm border border-medium px-1.5 py-0.5 label-sm text-primary">
					<Icon name="bookmark" className="size-3" />
					Save preset
				</span>
				.
			</p>
		</div>
	)
}

function SavedDownloadRow({
	preset,
	onRun,
	onRenameRequest,
	onDeleteRequest
}: {
	preset: SavedDownload
	onRun: (preset: SavedDownload) => void
	onRenameRequest: (preset: SavedDownload) => void
	onDeleteRequest: (preset: SavedDownload) => void
}) {
	const style = kindStyle(preset.kind)
	const description = describeSavedConfig(preset)
	const sourceLabel = resolvedLabel(preset)
	const timestamp = preset.lastRunAt
		? { prefix: 'ran', value: preset.lastRunAt }
		: { prefix: 'saved', value: preset.createdAt }

	return (
		<li className="group relative flex items-center gap-3 border-t border-subtle py-3.5 pr-3 pl-4 transition-colors first:border-t-0 hover:bg-hover-row">
			<span
				className={`absolute top-2 bottom-2 left-1 w-0.5 rounded-full ${style.accent} opacity-30 transition-all group-focus-within:opacity-100 group-hover:opacity-100`}
				aria-hidden="true"
			/>

			{/* The run button stretches over the whole row, so a tap anywhere outside Rename and Delete runs the preset. */}
			<button
				type="button"
				onClick={() => onRun(preset)}
				aria-label={`Run preset ${preset.name}`}
				className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left after:absolute after:inset-0"
			>
				<span className="flex items-baseline gap-2">
					<span className={`shrink-0 label-xs tracking-wider uppercase ${style.fg}`}>{style.label}</span>
					<span className="truncate label-md text-primary">{preset.name}</span>
				</span>
				<span className="flex min-w-0 items-center gap-2 body-sm text-tertiary">
					<span className="truncate text-secondary">{sourceLabel}</span>
					{description ? (
						<>
							<span aria-hidden="true" className="text-tertiary">
								·
							</span>
							<span className="truncate">{description}</span>
						</>
					) : null}
				</span>
			</button>

			{/* Clicks between the actions fall through to the run button. A touch screen cannot hover, so it always shows them. */}
			<div className="pointer-events-none relative flex h-8 shrink-0 items-center justify-end gap-2 pl-2 sm:min-w-[12rem]">
				<span className="label-sm text-tertiary tabular-nums transition-opacity pointer-fine:group-focus-within:opacity-0 pointer-fine:group-hover:opacity-0">
					<span className="hidden text-tertiary sm:inline">{timestamp.prefix} </span>
					<RelativeTime value={timestamp.value} input="milliseconds" />
				</span>

				<div className="flex items-center gap-0.5 transition-opacity pointer-fine:absolute pointer-fine:inset-y-0 pointer-fine:right-0 pointer-fine:pl-2 pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100">
					<Tooltip
						content="Rename"
						render={
							<Button
								variant="ghost"
								size="sm"
								square
								onClick={() => onRenameRequest(preset)}
								aria-label={`Rename ${preset.name}`}
								className="pointer-events-auto"
							/>
						}
					>
						<Icon name="pencil" className="size-4" />
					</Tooltip>
					<Tooltip
						content="Delete"
						render={
							<Button
								variant="ghostDestructive"
								size="sm"
								square
								onClick={() => onDeleteRequest(preset)}
								aria-label={`Delete ${preset.name}`}
								className="pointer-events-auto"
							/>
						}
					>
						<Icon name="trash-2" className="size-4" />
					</Tooltip>
					<span
						aria-hidden="true"
						className="ml-1 hidden items-center gap-1 rounded-md bg-brand px-2.5 py-1 label-sm text-on-brand shadow-sm pointer-fine:inline-flex"
					>
						<Icon name="download-cloud" className="size-3.5" />
						Run
					</span>
				</div>
			</div>
		</li>
	)
}
