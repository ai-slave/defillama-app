import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { matchSorter } from 'match-sorter'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { isChartDataRow } from '~/containers/LlamaAI/chartTypes'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
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

// Owns all three throws and the optional-chained response check, none of which the compiler can lower
// inside a try. Snapshot at insert time: the article keeps this data forever; no live link.
async function loadInsertableChart(
	authorizedFetch: (url: string, init?: RequestInit) => Promise<Response | null>,
	chartId: string,
	signal: AbortSignal
) {
	const res = await authorizedFetch(`${AI_SERVER}/charts/${chartId}`, { signal })
	if (!res?.ok) throw new Error('Failed to load chart data')
	const detail = await res.json()
	if (!isChartDataRow(detail)) throw new Error('Chart has no usable data to insert')
	const attrs = createLlamaAIChartAttrs(detail.chartConfig, detail.chartData)
	if (!attrs) throw new Error('Chart has no usable data to insert')
	return attrs
}

function insertChartError(error: unknown) {
	return error instanceof Error ? error.message : 'Failed to insert chart'
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
	const [insertingId, setInsertingId] = useState<string | null>(null)
	const insertion = useRef<AbortController | null>(null)
	useEffect(
		() => () => {
			insertion.current?.abort()
			insertion.current = null
		},
		[]
	)

	const { data, isLoading, isError, refetch } = useQuery({
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
		const dialogStillOpen = () => !controller.signal.aborted && dialogStore.getState().open
		const editorStillReady = () => dialogStillOpen() && !editor.isDestroyed && editor.isEditable
		// The finalizer guarded an early return, so the body settles in its own function first and the
		// clean-up follows it. The swallowing catch is what makes that the same thing.
		const insert = async () => {
			try {
				const attrs = await loadInsertableChart(authorizedFetch, item.id, controller.signal)
				if (!editorStillReady()) return
				editor
					.chain()
					.focus()
					.insertLlamaAIChart({ ...attrs, savedChartId: item.id })
					.run()
				dialogStore.hide()
			} catch (error) {
				if (dialogStillOpen()) toast.error(insertChartError(error))
			}
		}
		await insert()
		if (insertion.current === controller) {
			insertion.current = null
			setInsertingId(null)
		}
	}

	return (
		<Ariakit.Dialog
			store={dialogStore}
			className={`${dialogSurfaceStyles} flex max-h-[80dvh] w-full max-w-md flex-col gap-3 overflow-y-auto p-4`}
			unmountOnHide
			portal
		>
			<div className="flex items-center justify-between">
				<DialogHeading className="text-base font-semibold">Insert from LlamaAI</DialogHeading>
				<DialogCloseButton />
			</div>
			<Input
				name="llamaai-chart-search"
				aria-label="Search saved charts"
				placeholder="Search your saved charts…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>
			{!isAuthenticated ? (
				<p role="status" className="py-6 text-center text-sm">
					Sign in to insert your saved charts.
				</p>
			) : isError ? (
				<div role="alert" className="grid justify-items-center gap-3 py-6 text-sm">
					<p>Could not load saved charts.</p>
					<button type="button" onClick={() => void refetch()} className="rounded-md border border-medium px-3 py-2">
						Try again
					</button>
				</div>
			) : isLoading ? (
				<div className="flex justify-center py-6">
					<LoadingSpinner size={18} />
				</div>
			) : charts.length === 0 ? (
				<p role="status" className="py-6 text-center text-sm opacity-60">
					{data?.length
						? 'No saved charts match your search.'
						: 'No saved charts yet. Save one from a LlamaAI chat using the bookmark button on a chart.'}
				</p>
			) : (
				<div className="flex flex-col gap-0.5">
					{charts.map((item) => (
						<button
							key={item.id}
							type="button"
							disabled={!!insertingId}
							onClick={() => void handleInsert(item)}
							className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-research-wash disabled:opacity-60"
						>
							<Icon name="bar-chart-2" height={15} width={15} className="shrink-0 opacity-60" />
							<span className="min-w-0 flex-1">
								<span className="block truncate">{item.title}</span>
								<span className="block truncate text-xs opacity-50">
									{item.chart_type || 'chart'} · saved {formatDate(item.created_at) ?? '-'}
								</span>
							</span>
							{item.frozen ? (
								<span
									title="Data frozen at save time — never auto-refreshes"
									className="shrink-0 rounded-full bg-research-accent/10 px-2 py-0.5 text-[10px] text-research-accent-strong dark:text-research-accent-soft"
								>
									frozen
								</span>
							) : null}
							{insertingId === item.id ? <LoadingSpinner size={13} /> : null}
						</button>
					))}
				</div>
			)}
		</Ariakit.Dialog>
	)
}
