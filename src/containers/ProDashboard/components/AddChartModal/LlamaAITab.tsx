import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useDeferredValue, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Icon } from '~/ui/Icon'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { PremiumFeatureGate } from '../PremiumFeatureGate'

interface SavedChart {
	id: string
	title: string
	description?: string
	original_query: string
	session_id?: string
	chart_type?: string
	created_at: string
	access_count: number
}

interface LlamaAITabProps {
	selectedChart: { id: string; title: string } | null
	onChartSelect: (chart: SavedChart | null) => void
}

export function LlamaAITab({ selectedChart, onChartSelect }: LlamaAITabProps) {
	const { authorizedFetch, user, hasActiveSubscription } = useAuthContext()
	const queryClient = useQueryClient()
	const [searchQuery, setSearchQuery] = useState('')
	const deferredSearchQuery = useDeferredValue(searchQuery)
	const [deleteTarget, setDeleteTarget] = useState<SavedChart | null>(null)
	const searchRef = useRef<HTMLInputElement>(null)

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ['pro-dashboard', 'saved-charts-list', user?.id],
		queryFn: async () => {
			const res = await authorizedFetch(`${AI_SERVER}/charts`)
			if (!res.ok) throw new Error('Failed to load charts')
			const json = await res.json()
			return json.charts as Array<SavedChart>
		},
		enabled: !!user,
		staleTime: 1000 * 60 * 5
	})

	const deleteMutation = useMutation({
		mutationFn: async (chartId: string) => {
			const res = await authorizedFetch(`${AI_SERVER}/charts/${chartId}`, { method: 'DELETE' })
			if (!res.ok) throw new Error('Failed to delete chart')
		},
		onSuccess: (_, chartId) => {
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'saved-charts-list'] })
			if (selectedChart?.id === chartId) onChartSelect(null)
			setDeleteTarget(null)
		}
	})

	if (!user) {
		return <SurfaceBodyStatus variant="empty">Sign in to access your saved LlamaAI charts</SurfaceBodyStatus>
	}

	if (!hasActiveSubscription) {
		return (
			<PremiumFeatureGate featureName="LlamaAI Charts" paywallReason="llamaai">
				{null}
			</PremiumFeatureGate>
		)
	}

	if (isLoading) return <SurfaceBodyLoadingStatus label="Loading saved charts" />

	if (error) {
		return (
			<SurfaceBodyStatus variant="error" contentClassName="flex flex-col items-center gap-2">
				The saved charts could not load.
				<Button size="sm" onClick={() => void refetch()}>
					Try again
				</Button>
			</SurfaceBodyStatus>
		)
	}

	if (!data?.length) {
		return (
			<SurfaceBodyStatus variant="empty">
				No saved charts yet. Save a chart from LlamaAI to add it to your dashboard.
			</SurfaceBodyStatus>
		)
	}

	const filteredCharts = deferredSearchQuery
		? matchSorter(data, deferredSearchQuery, {
				keys: ['title', 'original_query', 'description'],
				threshold: matchSorter.rankings.CONTAINS
			})
		: data

	return (
		<div className="flex flex-col gap-4">
			<input
				ref={searchRef}
				type="search"
				aria-label="Search saved charts"
				placeholder="Search saved charts…"
				onInput={(e) => setSearchQuery(e.currentTarget.value)}
				className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-3 py-2 text-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden"
			/>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				{filteredCharts.map((chart) => {
					const selected = selectedChart?.id === chart.id
					return (
						<div
							key={chart.id}
							className={`relative flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
								selected ? 'border-brand bg-brand/5' : 'border-pro-cards-border hover:border-brand/50'
							}`}
						>
							<div className="flex items-start gap-2">
								{/* The select button covers the card; delete and the chat link sit above it. */}
								<button
									type="button"
									aria-pressed={selected}
									onClick={() => onChartSelect(selected ? null : chart)}
									className="line-clamp-1 min-w-0 flex-1 text-left font-medium text-pro-text-primary after:absolute after:inset-0 after:rounded-lg"
								>
									{chart.title}
								</button>
								{selected ? <Icon name="check" height={16} width={16} className="shrink-0 text-brand" /> : null}
								<Button
									variant="ghost"
									size="sm"
									square
									aria-label={`Delete ${chart.title}`}
									onClick={() => {
										deleteMutation.reset()
										setDeleteTarget(chart)
									}}
									className="relative"
								>
									<Icon name="trash-2" height={14} width={14} />
								</Button>
							</div>
							<p className="line-clamp-2 text-xs text-pro-text-tertiary">{chart.original_query}</p>
							{chart.session_id ? (
								<a
									href={`/ai/chat/${chart.session_id}`}
									target="_blank"
									rel="noopener noreferrer"
									className="relative self-start text-xs text-link hover:underline"
								>
									View chat →
								</a>
							) : null}
						</div>
					)
				})}
			</div>

			{filteredCharts.length === 0 ? (
				<p role="status" className="py-8 text-center body-sm text-tertiary">
					No charts match your search
				</p>
			) : null}

			<ConfirmDialog
				open={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				portal
				unmountOnHide
				// The deleted card's button is gone, so a finished delete returns focus to the search field.
				finalFocus={deleteMutation.isSuccess ? searchRef : undefined}
				title="Delete chart?"
				description="The chart is deleted from LlamaAI. Dashboards that use it show an error instead."
				confirmLabel="Delete"
				pendingLabel={deleteMutation.isPending ? 'Deleting…' : null}
				error={deleteMutation.isError ? 'The chart could not be deleted. Try again.' : null}
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
			/>
		</div>
	)
}
