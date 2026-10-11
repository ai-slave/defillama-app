import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useDeferredValue, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Icon } from '~/ui/Icon'
import { SearchField } from '~/ui/SearchField'
import { EmptyState, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { queryReadFailed } from '~/utils/query'
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

/** The sign-in dialog stays mounted through every auth state, so a sign-in that sets the user ends on its own step
    instead of vanishing when the tab swaps the gate for the chart list. */
export function LlamaAITab({ selectedChart, onChartSelect }: LlamaAITabProps) {
	const signInDialogStore = Ariakit.useDialogStore()
	return (
		<>
			<SavedCharts selectedChart={selectedChart} onChartSelect={onChartSelect} onSignIn={signInDialogStore.show} />
			<SignInModal store={signInDialogStore} />
		</>
	)
}

function SavedCharts({ selectedChart, onChartSelect, onSignIn }: LlamaAITabProps & { onSignIn: () => void }) {
	const { authorizedFetch, user, hasActiveSubscription, loaders } = useAuthContext()
	const queryClient = useQueryClient()
	const [searchQuery, setSearchQuery] = useState('')
	const deferredSearchQuery = useDeferredValue(searchQuery)
	const [deleteTarget, setDeleteTarget] = useState<SavedChart | null>(null)
	const searchRef = useRef<HTMLInputElement>(null)
	// Where the delete confirm returns focus: its trigger, or the search field once the deleted card took the trigger.
	const returnFocus = useRef<HTMLElement | null>(null)

	const savedCharts = useQuery({
		queryKey: ['pro-dashboard', 'saved-charts-list', user?.id],
		queryFn: async () => {
			const res = await authorizedFetch(`${AI_SERVER}/charts`)
			if (!res.ok) throw new Error("Couldn't load charts.")
			const json = await res.json()
			return json.charts as Array<SavedChart>
		},
		enabled: !!user,
		staleTime: 1000 * 60 * 5
	})

	const deleteMutation = useMutation({
		mutationFn: async (chartId: string) => {
			const res = await authorizedFetch(`${AI_SERVER}/charts/${chartId}`, { method: 'DELETE' })
			if (!res.ok) throw new Error("Couldn't delete the chart. Try again.")
		},
		onSuccess: (_, chartId) => {
			void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'saved-charts-list'] })
			if (selectedChart?.id === chartId) onChartSelect(null)
		}
	})
	const data = savedCharts.data

	// A stored session is still loading: the sign-in gate would flash before the list.
	if (loaders.userLoading) return <SurfaceBodyLoadingStatus label="Loading saved charts" />

	if (!user) {
		return (
			<EmptyState
				size="md"
				icon="bookmark"
				title="Saved charts need an account"
				actions={
					<Button size="sm" variant="primary" onClick={onSignIn}>
						Sign in
					</Button>
				}
			>
				Sign in to add charts you saved in LlamaAI to this dashboard.
			</EmptyState>
		)
	}

	if (!hasActiveSubscription) {
		return (
			<PremiumFeatureGate featureName="LlamaAI Charts" paywallReason="llamaai">
				{null}
			</PremiumFeatureGate>
		)
	}

	// A failed refresh keeps the loaded list (and an open delete confirm); only a list that never loaded shows the error.
	if (queryReadFailed(savedCharts)) {
		return (
			<SurfaceBodyStatus variant="error" retry={savedCharts}>
				Couldn&apos;t load your saved charts.
			</SurfaceBodyStatus>
		)
	}

	if (savedCharts.isLoading) return <SurfaceBodyLoadingStatus label="Loading saved charts" />

	if (!data?.length) {
		return (
			<EmptyState size="md" icon="bookmark" title="No saved charts yet">
				Save a chart from LlamaAI to add it to your dashboard.
			</EmptyState>
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
			<SearchField
				ref={searchRef}
				label="Search saved charts"
				value={searchQuery}
				onChange={setSearchQuery}
				placeholder="Search saved charts…"
			/>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				{filteredCharts.map((chart) => {
					const selected = selectedChart?.id === chart.id
					return (
						<div
							key={chart.id}
							// OptionTile's look; the tile holds a delete button, so it cannot be one button itself.
							className={`relative flex flex-col gap-2 rounded-lg border p-3 ${
								selected
									? 'border-brand bg-brand-muted'
									: 'border-medium hover:bg-hover-row has-focus-visible:bg-hover-row'
							}`}
						>
							<div className="flex items-start gap-2">
								{/* The select button covers the card; delete and the chat link sit above it. */}
								<button
									type="button"
									aria-pressed={selected}
									onClick={() => onChartSelect(selected ? null : chart)}
									className="line-clamp-1 min-w-0 flex-1 text-left font-medium text-primary after:absolute after:inset-0 after:rounded-lg"
								>
									{chart.title}
								</button>
								{selected ? <Icon name="check" className="size-4 shrink-0 text-link" /> : null}
								<Tooltip
									content="Delete chart"
									render={
										<Button
											variant="ghost"
											size="sm"
											square
											aria-label={`Delete ${chart.title}`}
											onClick={(event) => {
												returnFocus.current = event.currentTarget
												setDeleteTarget(chart)
											}}
											className="relative"
										/>
									}
								>
									<Icon name="trash-2" className="size-4" />
								</Tooltip>
							</div>
							<p className="line-clamp-2 body-sm text-tertiary">{chart.original_query}</p>
							{chart.session_id ? (
								<a
									href={`/ai/chat/${chart.session_id}`}
									target="_blank"
									rel="noopener noreferrer"
									className="relative self-start body-sm text-link hover:underline"
								>
									View chat →
								</a>
							) : null}
						</div>
					)
				})}
			</div>

			{filteredCharts.length === 0 ? (
				// Not NoResults: this line announces itself while the reader types, and NoResults has no live region.
				<p role="status" className="py-8 text-center body-sm text-tertiary">
					No charts match your search
				</p>
			) : null}

			{deleteTarget ? (
				<ConfirmActionDialog
					portal
					title="Delete chart?"
					description="The chart is deleted from LlamaAI. Dashboards that use it show an error instead."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					errorMessage="Couldn't delete the chart."
					mutation={deleteMutation}
					variables={deleteTarget.id}
					finalFocus={returnFocus}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => {
						returnFocus.current = searchRef.current
					}}
				/>
			) : null}
		</div>
	)
}
