import * as Ariakit from '@ariakit/react'
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, type KeyboardEvent, useCallback, useDeferredValue, useId, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/components/Icon'
import { AI_SERVER } from '~/constants'
import { useGetLiteDashboards } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { type Dashboard, dashboardAPI } from '~/containers/ProDashboard/services/DashboardAPI'
import type { LlamaAIChartConfig } from '~/containers/ProDashboard/types'
import { addItemToDashboard } from '~/containers/ProDashboard/utils/dashboardItemsUtils'
import { useAuthContext } from '~/containers/Subscription/auth'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Input } from '~/ui/Input'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import type { DashboardChartConfig, LlamaAIChartInput } from './AddToDashboardButton'

const EMPTY_DASHBOARDS: Dashboard[] = []
const EMPTY_UNSUPPORTED_METRICS: string[] = []
type AddToDashboardSubmitType = 'new-dashboard' | 'existing-dashboard'

interface AddToDashboardModalProps {
	dialogStore: Ariakit.DialogStore
	chartConfig: DashboardChartConfig | null
	llamaAIChart?: LlamaAIChartInput | null
	unsupportedMetrics?: string[]
}

function getConfigName(config: DashboardChartConfig | null, llamaAIChart?: LlamaAIChartInput | null): string {
	if (llamaAIChart) return llamaAIChart.title
	if (!config) return ''
	if (config.kind === 'multi') {
		return config.name || ''
	}
	if (config.kind === 'yields') {
		return config.poolName || ''
	}
	if (config.kind === 'stablecoins') {
		const chartTypeLabels: Record<string, string> = {
			totalMcap: 'Total Market Cap',
			tokenMcaps: 'Token Market Caps',
			pie: 'Pie',
			dominance: 'Dominance',
			usdInflows: 'USD Inflows',
			tokenInflows: 'Token Inflows'
		}
		const label = chartTypeLabels[config.chartType] || config.chartType
		return config.chain === 'All' ? `Stablecoins ${label}` : `${config.chain} Stablecoins ${label}`
	}
	if (config.kind === 'stablecoin-asset') {
		const chartTypeLabels: Record<string, string> = {
			totalCirc: 'Total Circulating',
			chainMcaps: 'By Chain',
			chainPie: 'Pie',
			chainDominance: 'Chain Dominance'
		}
		const label = chartTypeLabels[config.chartType] || config.chartType
		return `${config.stablecoin} ${label}`
	}
	return config.name || ''
}

function invalidateDashboardQueries(queryClient: QueryClient) {
	void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'dashboards'] })
	void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'my-dashboards'] })
	void queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'lite-dashboards'] })
}

function trackAddToDashboardSubmit(type: AddToDashboardSubmitType) {
	trackUmamiEvent('dashboard-add-chart-submit', { type })
}

function safeTrackAddToDashboardSubmit(type: AddToDashboardSubmitType) {
	try {
		trackAddToDashboardSubmit(type)
	} catch {
		// Ignore analytics failures so dashboard operations can still succeed.
	}
}

function showViewToast(message: string, href: string, onNavigate: (href: string) => void | Promise<boolean>) {
	toast.success(
		(t) => (
			<div>
				{message}{' '}
				<button
					type="button"
					className="underline"
					onClick={() => {
						toast.dismiss(t.id)
						void onNavigate(href)
					}}
				>
					View →
				</button>
			</div>
		),
		{ duration: 5000 }
	)
}

function getErrorMessage(error: unknown, fallback: string): string {
	const errorMsg = error instanceof Error ? error.message : ''
	return errorMsg || fallback
}

interface AddToDashboardMutationVariables {
	isCreatingNew: boolean
	nextDashboardName: string
	nextChartName: string
	selectedDashboardId: string | null
}

interface AddToDashboardMutationResult {
	type: AddToDashboardSubmitType
	message: string
	href: string
}

interface BuildChartToAddParams {
	authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch']
	chartConfig: DashboardChartConfig | null
	llamaAIChart?: LlamaAIChartInput | null
	configName: string
	nextChartName: string
}

async function buildChartToAdd({
	authorizedFetch,
	chartConfig,
	llamaAIChart,
	configName,
	nextChartName
}: BuildChartToAddParams): Promise<DashboardChartConfig | LlamaAIChartConfig | null> {
	if (llamaAIChart) {
		let savedChartId: string

		if (llamaAIChart.sessionId) {
			const res = await authorizedFetch(`${AI_SERVER}/agentic/save-chart`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: llamaAIChart.sessionId,
					chartId: llamaAIChart.chartId,
					title: nextChartName || llamaAIChart.title
				})
			})
			if (!res.ok) {
				throw new Error('Failed to save chart')
			}
			const data = await res.json()
			savedChartId = data.id
		} else {
			const res = await authorizedFetch(`${AI_SERVER}/charts`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageId: llamaAIChart.messageId, chartId: llamaAIChart.chartId })
			})
			if (!res.ok) {
				throw new Error('Failed to save chart')
			}
			const data = await res.json()
			savedChartId = data.id
		}

		return {
			id: crypto.randomUUID(),
			kind: 'llamaai-chart',
			savedChartId,
			title: nextChartName || llamaAIChart.title
		} satisfies LlamaAIChartConfig
	}

	if (!chartConfig) return null
	if (chartConfig.kind === 'multi' || chartConfig.kind === 'builder') {
		return { ...chartConfig, name: nextChartName || configName }
	}
	return { ...chartConfig }
}

interface SubmitAddToDashboardParams {
	authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch']
	chartConfig: DashboardChartConfig | null
	llamaAIChart?: LlamaAIChartInput | null
	configName: string
	dashboardNameById: Map<string, string>
	dashboardSlugById: Map<string, string | undefined>
	variables: AddToDashboardMutationVariables
}

async function submitAddToDashboard({
	authorizedFetch,
	chartConfig,
	llamaAIChart,
	configName,
	dashboardNameById,
	dashboardSlugById,
	variables
}: SubmitAddToDashboardParams): Promise<AddToDashboardMutationResult> {
	const chartToAdd = await buildChartToAdd({
		authorizedFetch,
		chartConfig,
		llamaAIChart,
		configName,
		nextChartName: variables.nextChartName
	})
	if (!chartToAdd) {
		throw new Error('No chart to add')
	}

	if (variables.isCreatingNew) {
		const dashboard = await dashboardAPI.createDashboard(
			{
				items: [chartToAdd],
				dashboardName: variables.nextDashboardName,
				timePeriod: '90d',
				visibility: 'private',
				tags: [],
				description: ''
			},
			authorizedFetch
		)

		return {
			type: 'new-dashboard',
			message: 'Dashboard created!',
			href: `/pro/${dashboard.slug || dashboard.id}`
		}
	}

	const selectedDashboardId = variables.selectedDashboardId
	if (!selectedDashboardId) {
		throw new Error('Please select a dashboard')
	}

	await addItemToDashboard(selectedDashboardId, chartToAdd, authorizedFetch)
	const selectedName = dashboardNameById.get(selectedDashboardId) ?? 'dashboard'

	return {
		type: 'existing-dashboard',
		message: `Added to ${selectedName}!`,
		href: `/pro/${dashboardSlugById.get(selectedDashboardId) || selectedDashboardId}`
	}
}

export function AddToDashboardModal({
	dialogStore,
	chartConfig,
	llamaAIChart,
	unsupportedMetrics = EMPTY_UNSUPPORTED_METRICS
}: AddToDashboardModalProps) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated, hasActiveSubscription } = useAuthContext()
	const { data: dashboardsData, isLoading: isLoadingDashboards } = useGetLiteDashboards()
	const dashboards = dashboardsData ?? EMPTY_DASHBOARDS

	const configName = getConfigName(chartConfig, llamaAIChart)
	const [search, setSearch] = useState('')
	const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null)
	const [isCreatingNew, setIsCreatingNew] = useState(false)
	const [newDashboardNameInput, setNewDashboardNameInput] = useState('')
	const chartNameInputId = useId()
	const deferredSearch = useDeferredValue(search)

	const filteredDashboards = useMemo(() => {
		const query = deferredSearch.trim()
		if (!query) return dashboards
		return matchSorter(dashboards, query, {
			keys: ['name'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [dashboards, deferredSearch])

	const dashboardNameById = useMemo(() => {
		return new Map<string, string>(dashboards.map((dashboard) => [dashboard.id, dashboard.name]))
	}, [dashboards])

	const dashboardSlugById = useMemo(() => {
		return new Map<string, string | undefined>(dashboards.map((dashboard) => [dashboard.id, dashboard.slug]))
	}, [dashboards])

	const handleSelectDashboard = useCallback((id: string) => {
		startTransition(() => {
			setSelectedDashboardId(id)
			setIsCreatingNew(false)
		})
	}, [])

	const handleCreateNew = useCallback(() => {
		setIsCreatingNew(true)
		startTransition(() => setSelectedDashboardId(null))
		setNewDashboardNameInput('')
	}, [])

	const handleSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
		}
	}, [])

	const { mutate: submitAddToDashboardMutation, isPending: isSubmitting } = useMutation({
		mutationFn: async (variables: AddToDashboardMutationVariables) => {
			return submitAddToDashboard({
				authorizedFetch,
				chartConfig,
				llamaAIChart,
				configName,
				dashboardNameById,
				dashboardSlugById,
				variables
			})
		},
		onSuccess: (result) => {
			invalidateDashboardQueries(queryClient)
			safeTrackAddToDashboardSubmit(result.type)
			showViewToast(result.message, result.href, router.push)
			dialogStore.hide()
		},
		onError: (error, variables) => {
			const fallbackErrorMessage = variables.isCreatingNew ? 'Failed to create dashboard' : 'Failed to add chart'
			toast.error(getErrorMessage(error, fallbackErrorMessage))
		}
	})

	const handleAdd = useCallback(
		(event: FormSubmitEvent) => {
			event.preventDefault()
			if (!isAuthenticated || !hasActiveSubscription) return
			if (isSubmitting) return

			const formData = new FormData(event.currentTarget)
			const nextDashboardNameValue = formData.get('newDashboardName')
			const nextChartNameValue = formData.get('chartName')
			const nextDashboardName = (typeof nextDashboardNameValue === 'string' ? nextDashboardNameValue : '').trim()
			const nextChartName = (typeof nextChartNameValue === 'string' ? nextChartNameValue : '').trim()

			if (isCreatingNew && !nextDashboardName) {
				toast.error('Please enter a dashboard name')
				return
			}

			if (!isCreatingNew && !selectedDashboardId) {
				toast.error('Please select a dashboard')
				return
			}

			submitAddToDashboardMutation({
				isCreatingNew,
				nextDashboardName,
				nextChartName,
				selectedDashboardId
			})
		},
		[
			hasActiveSubscription,
			isAuthenticated,
			isCreatingNew,
			isSubmitting,
			selectedDashboardId,
			submitAddToDashboardMutation
		]
	)

	if (!isAuthenticated || !hasActiveSubscription) {
		return null
	}

	const canSubmit = isCreatingNew ? newDashboardNameInput.trim().length > 0 : selectedDashboardId !== null

	return (
		<Ariakit.Dialog
			store={dialogStore}
			className={`${dialogSurfaceStyles} [--dialog-width:448px]`}
			unmountOnHide
			portal
			hideOnInteractOutside
		>
			<form onSubmit={handleAdd} className="flex min-h-0 flex-1 flex-col">
				<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<DialogHeading>Add to Dashboard</DialogHeading>
					<DialogCloseButton className="-mr-1" />
				</div>

				<div className="flex thin-scrollbar min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-3">
					<label className="relative block">
						<span className="sr-only">Search dashboards</span>
						<Icon
							name="search"
							className="pointer-events-none absolute top-0 bottom-0 left-3 my-auto size-4 text-tertiary"
						/>
						<Input
							type="text"
							onInput={(e) => setSearch(e.currentTarget.value)}
							onKeyDown={handleSearchKeyDown}
							placeholder="Search dashboards..."
							className="w-full pl-8"
						/>
					</label>

					<div className="thin-scrollbar max-h-56 overflow-y-auto overscroll-contain">
						{isLoadingDashboards ? (
							<div role="status" aria-live="polite" className="flex items-center justify-center py-8">
								<div className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
								<span className="sr-only">Loading dashboards</span>
							</div>
						) : filteredDashboards.length === 0 && !search.trim() ? (
							<p role="status" aria-live="polite" className="py-6 text-center body-sm text-tertiary">
								No dashboards yet
							</p>
						) : filteredDashboards.length === 0 ? (
							<p role="status" aria-live="polite" className="py-6 text-center body-sm text-tertiary">
								No matches found
							</p>
						) : (
							<div className="flex flex-col gap-0.5">
								{filteredDashboards.map((dashboard: (typeof dashboards)[number]) => {
									const isSelected = selectedDashboardId === dashboard.id
									return (
										<button
											key={dashboard.id}
											type="button"
											onClick={() => handleSelectDashboard(dashboard.id)}
											className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left body-sm transition-colors ${
												isSelected
													? 'bg-brand-muted text-link'
													: 'text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary'
											}`}
										>
											<span
												className={`grid size-4 shrink-0 place-items-center text-link ${isSelected ? '' : 'invisible'}`}
											>
												<Icon name="check" className="size-3" />
											</span>
											<span className="truncate">{dashboard.name}</span>
										</button>
									)
								})}
							</div>
						)}
					</div>

					<div>
						{isCreatingNew ? (
							<Input
								type="text"
								name="newDashboardName"
								required={isCreatingNew}
								onChange={(e) => setNewDashboardNameInput(e.target.value)}
								placeholder="New dashboard name..."
								className="w-full"
							/>
						) : (
							<Button type="button" size="md" onClick={handleCreateNew} className="w-full">
								<Icon name="plus" className="size-4" />
								<span>Create new dashboard</span>
							</Button>
						)}
					</div>

					{chartConfig && (chartConfig.kind === 'multi' || chartConfig.kind === 'builder') ? (
						<div className="border-t border-subtle pt-4">
							<label htmlFor={chartNameInputId} className="mb-1.5 block label-sm text-tertiary">
								Chart name
							</label>
							<Input
								id={chartNameInputId}
								type="text"
								name="chartName"
								defaultValue={configName}
								placeholder={configName || 'Enter chart name...'}
								className="w-full"
							/>
						</div>
					) : null}

					{unsupportedMetrics.length > 0 ? (
						<div className="rounded-lg border border-medium bg-surface px-3 py-2">
							<p className="body-sm text-warning">
								{unsupportedMetrics.length} metric{unsupportedMetrics.length > 1 ? 's' : ''} not supported:{' '}
								{unsupportedMetrics.join(', ')}
							</p>
						</div>
					) : null}
				</div>

				<div className="flex gap-2 border-t border-subtle px-4 py-3">
					<Ariakit.DialogDismiss disabled={isSubmitting} render={<Button type="button" size="md" className="flex-1" />}>
						Cancel
					</Ariakit.DialogDismiss>
					<Button type="submit" variant="primary" size="md" disabled={isSubmitting || !canSubmit} className="flex-1">
						{isSubmitting ? (
							<div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : (
							<>
								<Icon name="plus" className="size-3.5" />
								Add to Dashboard
							</>
						)}
					</Button>
				</div>
			</form>
		</Ariakit.Dialog>
	)
}
