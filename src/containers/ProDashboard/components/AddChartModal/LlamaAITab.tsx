import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useDeferredValue, useState } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
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
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

	const { data, isLoading, error } = useQuery({
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
			setDeleteConfirmId(null)
		}
	})

	if (!user) {
		return (
			<div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
				<p className="text-sm text-pro-text-secondary">Sign in to access your saved LlamaAI charts</p>
			</div>
		)
	}

	if (!hasActiveSubscription) {
		return (
			<PremiumFeatureGate featureName="LlamaAI Charts" paywallReason="llamaai">
				{null}
			</PremiumFeatureGate>
		)
	}

	if (isLoading) {
		return (
			<div className="flex min-h-[300px] items-center justify-center text-pro-text-tertiary">
				<LoadingSpinner size={24} />
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex min-h-[300px] flex-col items-center justify-center gap-2">
				<Icon name="alert-triangle" height={24} width={24} className="text-sub-orange" />
				<p className="text-sm text-pro-text-secondary">Failed to load saved charts</p>
			</div>
		)
	}

	const filteredCharts = deferredSearchQuery
		? matchSorter(data ?? [], deferredSearchQuery, {
				keys: ['title', 'original_query', 'description'],
				threshold: matchSorter.rankings.CONTAINS
			})
		: data

	if (!data?.length) {
		return (
			<div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
				<div>
					<p className="font-medium text-pro-text-primary">No saved charts yet</p>
					<p className="mt-1 text-sm text-pro-text-tertiary">Save charts from LlamaAI to add them to your dashboard</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div>
				<input
					type="text"
					placeholder="Search saved charts..."
					onInput={(e) => setSearchQuery(e.currentTarget.value)}
					className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-3 py-2 text-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden"
				/>
			</div>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				{filteredCharts?.map((chart) => (
					<button
						type="button"
						key={chart.id}
						onClick={() => onChartSelect(selectedChart?.id === chart.id ? null : chart)}
						className={`group flex flex-col gap-2 rounded-lg border p-3 text-left transition-all ${
							selectedChart?.id === chart.id
								? 'border-brand bg-brand/5'
								: 'border-pro-cards-border hover:border-brand/50'
						}`}
					>
						<div className="flex items-start justify-between gap-2">
							<h4 className="line-clamp-1 font-medium text-pro-text-primary">{chart.title}</h4>
							<div className="flex shrink-0 items-center gap-1">
								{selectedChart?.id === chart.id ? (
									<Icon name="check" height={16} width={16} className="text-brand" />
								) : null}
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation()
										setDeleteConfirmId(chart.id)
									}}
									className="rounded-sm p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10"
								>
									<Icon name="x" height={14} width={14} className="text-pro-text-tertiary" />
								</button>
							</div>
						</div>
						<p className="line-clamp-2 text-xs text-pro-text-tertiary">{chart.original_query}</p>
						{chart.session_id ? (
							<a
								href={`/ai/chat/${chart.session_id}`}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(e) => e.stopPropagation()}
								className="text-xs text-brand text-pro-text-tertiary hover:underline"
							>
								View chat →
							</a>
						) : null}
					</button>
				))}
			</div>

			{filteredCharts?.length === 0 && searchQuery ? (
				<p className="py-8 text-center text-sm text-pro-text-tertiary">No charts match your search</p>
			) : null}

			{deleteConfirmId ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					role="presentation"
					onClick={() => setDeleteConfirmId(null)}
				>
					<div
						className="pro-card mx-4 w-full max-w-sm rounded-lg p-4"
						role="presentation"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="font-medium text-pro-text-primary">Delete chart?</h3>
						<p className="mt-2 text-sm text-pro-text-tertiary">
							This will permanently delete the chart. Dashboards using it will show an error.
						</p>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setDeleteConfirmId(null)}
								className="rounded-sm px-3 py-1.5 text-sm text-pro-text-secondary hover:bg-black/5 dark:hover:bg-white/5"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => deleteMutation.mutate(deleteConfirmId)}
								disabled={deleteMutation.isPending}
								className="rounded-sm bg-error px-3 py-1.5 text-sm text-on-brand hover:bg-red-600 disabled:opacity-50"
							>
								{deleteMutation.isPending ? 'Deleting...' : 'Delete'}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	)
}
