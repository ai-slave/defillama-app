import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { matchSorter } from 'match-sorter'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { isChartDataRow } from '~/containers/LlamaAI/chartTypes'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { createLlamaAIChartAttrs } from '../llamaaiChart'

interface SavedChartListItem {
	id: string
	title: string
	chart_type?: string
	created_at: string
	frozen?: boolean
}

function parseSavedChartList(value: unknown): Array<SavedChartListItem> {
	if (!isChartDataRow(value) || !Array.isArray(value.charts)) return []
	const charts: Array<SavedChartListItem> = []
	for (const chart of value.charts) {
		if (!isChartDataRow(chart)) continue
		if (typeof chart.id !== 'string' || typeof chart.title !== 'string' || typeof chart.created_at !== 'string')
			continue
		if (chart.chart_type !== undefined && typeof chart.chart_type !== 'string') continue
		if (chart.frozen !== undefined && typeof chart.frozen !== 'boolean') continue
		charts.push({
			id: chart.id,
			title: chart.title,
			created_at: chart.created_at,
			...(typeof chart.chart_type === 'string' ? { chart_type: chart.chart_type } : {}),
			...(typeof chart.frozen === 'boolean' ? { frozen: chart.frozen } : {})
		})
	}
	return charts
}

// Owns the throw and the optional-chained response check, which the compiler cannot lower inside a try.
// Snapshot at insert time: the article keeps this data forever; no live link. Null: the chart has no usable data.
async function loadInsertableChart(
	authorizedFetch: (url: string, init?: RequestInit) => Promise<Response | null>,
	chartId: string,
	signal: AbortSignal
) {
	const res = await authorizedFetch(`${AI_SERVER}/charts/${chartId}`, { signal })
	if (!res?.ok) throw new Error('Failed to load chart data')
	const detail = await res.json()
	if (!isChartDataRow(detail)) return null
	return createLlamaAIChartAttrs(detail.chartConfig, detail.chartData)
}

// The API sends the renderer's type ("area", "bar"); readers see "Area chart".
function chartTypeLabel(type: string | undefined) {
	return type ? `${type[0].toUpperCase()}${type.slice(1)} chart` : 'Chart'
}

export function LlamaAIChartPickerDialog({
	dialogStore,
	editor
}: {
	dialogStore: Ariakit.DialogStore
	editor: Editor | null
}) {
	const { isAuthenticated } = useAuthContext()
	const open = Ariakit.useStoreState(dialogStore, 'open')
	const [search, setSearch] = useState('')
	return open ? (
		<SavedChartPickerSession
			key={isAuthenticated ? 'signed-in' : 'signed-out'}
			dialogStore={dialogStore}
			editor={editor}
			search={search}
			setSearch={setSearch}
		/>
	) : null
}

function SavedChartPickerSession({
	dialogStore,
	editor,
	search,
	setSearch
}: {
	dialogStore: Ariakit.DialogStore
	editor: Editor | null
	search: string
	setSearch: (value: string) => void
}) {
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const isSmallScreen = useMedia('(max-width: 639px)')
	const searchRef = useRef<HTMLInputElement>(null)
	const [insertingId, setInsertingId] = useState<string | null>(null)
	// Shown under the row that failed; the next insertion clears it.
	const [insertError, setInsertError] = useState<{ id: string; message: string } | null>(null)
	const insertion = useRef<AbortController | null>(null)
	useEffect(
		() => () => {
			insertion.current?.abort()
			insertion.current = null
		},
		[]
	)

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey: ['llamaai-saved-charts-picker'],
		queryFn: async ({ signal }) => {
			const res = await authorizedFetch(`${AI_SERVER}/charts`, { signal })
			if (!res?.ok) throw new Error('Failed to load saved charts')
			return parseSavedChartList(await res.json())
		},
		enabled: isAuthenticated,
		staleTime: 60_000
	})

	const charts = useMemo(() => {
		const all = data ?? []
		if (!search.trim()) return all
		return matchSorter(all, search, { keys: ['title'] })
	}, [data, search])

	const handleInsert = async (item: SavedChartListItem) => {
		if (!isAuthenticated || !editor || !editor.isEditable || insertion.current) return
		const controller = new AbortController()
		insertion.current = controller
		setInsertingId(item.id)
		setInsertError(null)
		const dialogStillOpen = () => !controller.signal.aborted && dialogStore.getState().open
		const editorStillReady = () => dialogStillOpen() && !editor.isDestroyed && editor.isEditable
		// The finalizer guarded an early return, so the body settles in its own function first and the
		// clean-up follows it. The swallowing catch is what makes that the same thing.
		const insert = async () => {
			try {
				const attrs = await loadInsertableChart(authorizedFetch, item.id, controller.signal)
				if (!attrs) {
					if (dialogStillOpen()) setInsertError({ id: item.id, message: 'This chart has no data to insert.' })
					return
				}
				if (!editorStillReady()) return
				editor
					.chain()
					.focus()
					.insertLlamaAIChart({ ...attrs, savedChartId: item.id })
					.run()
				dialogStore.hide()
			} catch {
				if (dialogStillOpen()) setInsertError({ id: item.id, message: "Couldn't insert this chart. Try again." })
			}
		}
		await insert()
		if (insertion.current === controller) {
			insertion.current = null
			setInsertingId(null)
		}
	}

	return (
		<Dialog store={dialogStore} size="md" fullSheet unmountOnHide portal>
			<DialogHeader title="Insert from LlamaAI" />
			{isAuthenticated ? (
				<DialogToolbar>
					<label className="relative block">
						<span className="sr-only">Search saved charts</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						{/* Phones skip the autofocus: the keyboard would cover the list before anyone asked to search. */}
						<Ariakit.Focusable
							autoFocus={!isSmallScreen}
							render={
								<Input
									ref={searchRef}
									name="llamaai-chart-search"
									inputMode="search"
									placeholder="Search your saved charts…"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className={searchFieldInputPlacementStyles}
								/>
							}
						/>
					</label>
				</DialogToolbar>
			) : null}
			<DialogBody kind="list">
				{!isAuthenticated ? (
					<SurfaceBodyStatus variant="empty">Sign in to insert your saved charts.</SurfaceBodyStatus>
				) : isError ? (
					<SurfaceBodyStatus variant="error">
						<div className="flex flex-col items-center gap-3">
							<p>Couldn&apos;t load your saved charts.</p>
							<Button
								type="button"
								size="md"
								pendingLabel={isFetching ? 'Retrying…' : null}
								onClick={() =>
									void refetch().then((result) => {
										// The retry button goes away with the error, so focus moves to the search that stays.
										if (result.isSuccess) searchRef.current?.focus()
									})
								}
							>
								Try again
							</Button>
						</div>
					</SurfaceBodyStatus>
				) : isLoading ? (
					<SurfaceBodyLoadingStatus label="Loading saved charts" />
				) : charts.length === 0 ? (
					<SurfaceBodyStatus variant="empty">
						{data?.length
							? 'No saved charts match your search.'
							: 'No saved charts yet. Save one from a LlamaAI chat using the bookmark button on a chart.'}
					</SurfaceBodyStatus>
				) : (
					// The same floor as the status states, so the dialog keeps its height as the list loads and filters.
					<ul className="flex flex-col gap-0.5 sm:min-h-90">
						{charts.map((item) => {
							const inserting = insertingId === item.id
							return (
								<li key={item.id}>
									{/* The row being inserted stays focusable (aria-disabled) so focus does not drop while it loads;
									    handleInsert ignores clicks while any insertion runs. */}
									<button
										type="button"
										disabled={insertingId !== null && !inserting}
										aria-disabled={inserting || undefined}
										aria-busy={inserting || undefined}
										onClick={() => void handleInsert(item)}
										className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left not-disabled:not-aria-disabled:hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress"
									>
										<Icon name="bar-chart-2" className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="truncate body-md text-primary">{item.title}</span>
											<span className="body-sm text-tertiary">
												{chartTypeLabel(item.chart_type)} · saved {formatDate(item.created_at) ?? '-'}
												{item.frozen ? ' · data frozen when saved' : null}
											</span>
										</span>
										{inserting ? (
											<span className="flex shrink-0 items-center gap-1 body-sm text-secondary">
												<LoadingSpinner size={14} />
												Inserting…
											</span>
										) : null}
									</button>
									{insertError?.id === item.id ? (
										<div className="px-2 pt-1 pb-2">
											<InlineStatus variant="error">{insertError.message}</InlineStatus>
										</div>
									) : null}
								</li>
							)
						})}
					</ul>
				)}
			</DialogBody>
		</Dialog>
	)
}
