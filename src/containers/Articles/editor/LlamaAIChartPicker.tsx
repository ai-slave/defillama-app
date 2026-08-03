import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { matchSorter } from 'match-sorter'
import { useMemo, useState } from 'react'
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

function parseSavedChartList(value: unknown): SavedChartListItem[] {
	if (!isChartDataRow(value) || !Array.isArray(value.charts)) return []
	const charts: SavedChartListItem[] = []
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

export function LlamaAIChartPickerDialog({
	dialogStore,
	editor
}: {
	dialogStore: Ariakit.DialogStore
	editor: Editor | null
}) {
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const open = Ariakit.useStoreState(dialogStore, 'open')
	const [search, setSearch] = useState('')
	const [insertingId, setInsertingId] = useState<string | null>(null)

	const { data, isLoading } = useQuery({
		queryKey: ['llamaai-saved-charts-picker'],
		queryFn: async () => {
			const res = await authorizedFetch(`${AI_SERVER}/charts`)
			if (!res?.ok) throw new Error('Failed to load saved charts')
			return parseSavedChartList(await res.json())
		},
		enabled: open && isAuthenticated,
		staleTime: 60_000
	})

	const charts = useMemo(() => {
		const all = data ?? []
		if (!search.trim()) return all
		return matchSorter(all, search, { keys: ['title'] })
	}, [data, search])

	const handleInsert = async (item: SavedChartListItem) => {
		if (!editor || insertingId) return
		setInsertingId(item.id)
		try {
			// Snapshot at insert time: the article keeps this data forever; no live link.
			const res = await authorizedFetch(`${AI_SERVER}/charts/${item.id}`)
			if (!res?.ok) throw new Error('Failed to load chart data')
			const detail = await res.json()
			if (!isChartDataRow(detail)) throw new Error('Chart has no usable data to insert')
			const attrs = createLlamaAIChartAttrs(detail.chartConfig, detail.chartData)
			if (!attrs) throw new Error('Chart has no usable data to insert')
			editor
				.chain()
				.focus()
				.insertLlamaAIChart({
					...attrs,
					savedChartId: item.id
				})
				.run()
			dialogStore.hide()
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to insert chart')
		} finally {
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
				placeholder="Search your saved charts…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>
			{isLoading ? (
				<div className="flex justify-center py-6">
					<LoadingSpinner size={18} />
				</div>
			) : charts.length === 0 ? (
				<p className="py-6 text-center text-sm opacity-60">
					No saved charts yet. Save one from a LlamaAI chat — the bookmark button on any chart — and it will show up
					here.
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
