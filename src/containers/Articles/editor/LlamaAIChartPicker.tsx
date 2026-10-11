import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { matchSorter } from 'match-sorter'
import { useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { isChartDataRow } from '~/containers/LlamaAI/chartTypes'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { ListRow } from '~/ui/ListRow'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { formatDate } from '~/utils/dateFormat'
import { queryReadFailed } from '~/utils/query'
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

// Snapshot at insert time: the article keeps this data forever; no live link.
async function loadInsertableChart(
	authorizedFetch: (url: string, init?: RequestInit) => Promise<Response | null>,
	chartId: string
) {
	let detail: unknown
	try {
		const res = await authorizedFetch(`${AI_SERVER}/charts/${chartId}`)
		if (!res?.ok) throw new Error("Couldn't load chart data.")
		detail = await res.json()
	} catch (error) {
		throw new Error("Couldn't insert this chart. Try again.", { cause: error })
	}
	const attrs = isChartDataRow(detail) ? createLlamaAIChartAttrs(detail.chartConfig, detail.chartData) : null
	if (!attrs) throw new Error('This chart has no data to insert.')
	return attrs
}

// The API sends the renderer's type ("area", "bar"); readers see "Area chart".
function chartTypeLabel(type: string | undefined) {
	return type ? `${type[0].toUpperCase()}${type.slice(1)} chart` : 'Chart'
}

// ArticlesAccessGate renders the editor only for a signed-in reader, so the picker never needs a sign-in state.
export function LlamaAIChartPickerDialog({
	dialogStore,
	editor
}: {
	dialogStore: Ariakit.DialogStore
	editor: Editor | null
}) {
	// Each opening is its own session: an insertion an earlier opening started settles into nothing.
	return Ariakit.useStoreState(dialogStore, 'open') ? (
		<SavedChartPickerSession dialogStore={dialogStore} editor={editor} />
	) : null
}

function SavedChartPickerSession({ dialogStore, editor }: { dialogStore: Ariakit.DialogStore; editor: Editor | null }) {
	const { authorizedFetch } = useAuthContext()
	const isSmallScreen = useMedia('(max-width: 639px)')
	const searchRef = useRef<HTMLInputElement>(null)
	const [search, setSearch] = useState('')
	// Shown under the row that failed. Not the mutation's own error, which clears while a retry runs.
	const [insertError, setInsertError] = useState<{ id: string; message: string } | null>(null)
	const insertMutation = useMutation({
		mutationFn: (item: SavedChartListItem) => loadInsertableChart(authorizedFetch, item.id)
	})
	const insertingId = insertMutation.isPending ? insertMutation.variables.id : null

	const chartsQuery = useQuery({
		queryKey: ['llamaai-saved-charts-picker'],
		queryFn: async ({ signal }) => {
			const res = await authorizedFetch(`${AI_SERVER}/charts`, { signal })
			if (!res?.ok) throw new Error("Couldn't load saved charts.")
			return parseSavedChartList(await res.json())
		},
		staleTime: 60_000
	})
	const { data, isLoading, isFetching, refetch } = chartsQuery

	const charts = useMemo(() => {
		const all = data ?? []
		if (!search.trim()) return all
		return matchSorter(all, search, { keys: ['title'] })
	}, [data, search])

	// The per-call callbacks belong to this opening: closing the picker unmounts it, and React Query drops them.
	const handleInsert = (item: SavedChartListItem) => {
		if (!editor || insertMutation.isPending) return
		if (insertError?.id !== item.id) setInsertError(null)
		insertMutation.mutate(item, {
			onSuccess: (attrs) => {
				if (editor.isDestroyed || !editor.isEditable) return
				editor
					.chain()
					.focus()
					.insertLlamaAIChart({ ...attrs, savedChartId: item.id })
					.run()
				dialogStore.hide()
			},
			onError: (error) => setInsertError({ id: item.id, message: error.message })
		})
	}

	return (
		<Dialog store={dialogStore} size="md" fullSheet unmountOnHide portal>
			<DialogHeader title="Insert from LlamaAI" />
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
			<DialogBody kind="list">
				{queryReadFailed(chartsQuery) ? (
					<SurfaceBodyStatus variant="error">
						<div className="flex flex-col items-center gap-3">
							<p>Couldn&apos;t load your saved charts.</p>
							<Button
								type="button"
								size="sm"
								pendingLabel="Retrying…"
								pending={isFetching}
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
							const unavailable = insertingId !== null && !inserting
							return (
								<li key={item.id}>
									{/* Every row stays focusable (aria-disabled) while an insertion runs, so focus does not drop;
									    handleInsert ignores clicks until it settles. */}
									<ListRow
										aria-disabled={insertingId !== null || undefined}
										aria-busy={inserting || undefined}
										onClick={() => handleInsert(item)}
										className="min-h-11 gap-3"
									>
										<Icon
											name="bar-chart-2"
											className={`size-4 shrink-0 ${unavailable ? 'text-disabled' : 'text-tertiary'}`}
											aria-hidden="true"
										/>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="truncate body-md">{item.title}</span>
											<span className={`body-sm ${unavailable ? 'text-disabled' : 'text-tertiary'}`}>
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
									</ListRow>
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
