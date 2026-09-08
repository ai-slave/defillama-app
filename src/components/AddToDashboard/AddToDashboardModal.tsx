import * as Ariakit from '@ariakit/react'
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import { startTransition, type KeyboardEvent, useCallback, useDeferredValue, useId, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import {
	clearChartRepairTarget,
	readChartRepairTarget,
	type ChartRepairTarget
} from '~/containers/LlamaAI/chartRepairTarget'
import {
	activateDashboardArtifactsWithConfirmation,
	buildLlamaAIChartDashboardItem,
	prepareStoredDashboardActivation
} from '~/containers/LlamaAI/dashboardArtifactFlow'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import { useGetLiteDashboards } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { dashboardAPI, type LiteDashboardSummary } from '~/containers/ProDashboard/services/DashboardAPI'
import { addItemToDashboard, replaceItemInDashboard } from '~/containers/ProDashboard/utils/dashboardItemsUtils'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatUsd } from '~/utils/numberFormat'
import type { DashboardChartConfig, LlamaAIChartInput } from './addToDashboardContract'

const EMPTY_DASHBOARDS: Array<LiteDashboardSummary> = []
const EMPTY_UNSUPPORTED_METRICS: Array<string> = []
type AddToDashboardSubmitType = 'new-dashboard' | 'existing-dashboard'

interface AddToDashboardModalProps {
	dialogStore: Ariakit.DialogStore
	chartConfig: DashboardChartConfig | null
	llamaAIChart?: LlamaAIChartInput | null
	unsupportedMetrics?: Array<string>
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
	repaired: boolean
}

async function activateAddedLlamaAIChart(
	authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch'],
	dashboard: Dashboard
): Promise<'active' | 'declined' | 'pending'> {
	const plan = prepareStoredDashboardActivation(dashboard.data.items)
	if (plan.expectedItemIds.length === 0) return 'active'
	const fetchAuthenticatedResponse = async (url: string, options?: RequestInit): Promise<Response> => {
		const response = await authorizedFetch(url, options)
		if (!response) throw new Error('Authentication is required to activate dashboard refreshes')
		return response
	}
	return activateDashboardArtifactsWithConfirmation(
		fetchAuthenticatedResponse,
		dashboard.id,
		plan,
		(estimatedMaxCostUsd) =>
			window.confirm(
				`This dashboard uses premium data. Daily refreshes will bill your account up to ${formatUsd(estimatedMaxCostUsd, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} per refresh window. Continue?`
			)
	)
}

interface BuildChartToAddParams {
	chartConfig: DashboardChartConfig | null
	llamaAIChart?: LlamaAIChartInput | null
	configName: string
	nextChartName: string
}

async function buildChartToAdd({
	chartConfig,
	llamaAIChart,
	configName,
	nextChartName
}: BuildChartToAddParams): Promise<DashboardItemConfig | null> {
	if (llamaAIChart) {
		return buildLlamaAIChartDashboardItem(llamaAIChart, nextChartName)
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
	repairTarget: ChartRepairTarget | null
}

async function submitAddToDashboard({
	authorizedFetch,
	chartConfig,
	llamaAIChart,
	configName,
	dashboardNameById,
	dashboardSlugById,
	variables,
	repairTarget
}: SubmitAddToDashboardParams): Promise<AddToDashboardMutationResult> {
	const chartToAdd = await buildChartToAdd({
		chartConfig,
		...(llamaAIChart === undefined ? {} : { llamaAIChart }),
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
		const activation = llamaAIChart ? await activateAddedLlamaAIChart(authorizedFetch, dashboard) : 'active'

		return {
			type: 'new-dashboard',
			message:
				activation === 'active'
					? 'Dashboard created!'
					: activation === 'declined'
						? 'Dashboard created. Daily refresh was not enabled.'
						: 'Dashboard created, but refresh setup is pending. The current snapshot is safe.',
			href: `/pro/${dashboard.slug || dashboard.id}`,
			repaired: false
		}
	}

	const selectedDashboardId = variables.selectedDashboardId
	if (!selectedDashboardId) {
		throw new Error('Please select a dashboard')
	}

	const isRepair = repairTarget?.dashboardId === selectedDashboardId
	const dashboard = isRepair
		? await replaceItemInDashboard(selectedDashboardId, repairTarget.itemId, chartToAdd, authorizedFetch)
		: await addItemToDashboard(selectedDashboardId, chartToAdd, authorizedFetch)
	const activation = llamaAIChart ? await activateAddedLlamaAIChart(authorizedFetch, dashboard) : 'active'
	const selectedName = dashboardNameById.get(selectedDashboardId) ?? 'dashboard'

	return {
		type: 'existing-dashboard',
		message:
			activation === 'active'
				? isRepair
					? `Replaced chart in ${selectedName}!`
					: `Added to ${selectedName}!`
				: activation === 'declined'
					? `Added to ${selectedName}. Daily refresh was not enabled.`
					: `Added to ${selectedName}, but refresh setup is pending. The current snapshot is safe.`,
		href: `/pro/${dashboardSlugById.get(selectedDashboardId) || selectedDashboardId}`,
		repaired: isRepair
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
	const [repairTarget, setRepairTarget] = useState<ChartRepairTarget | null>(() => readChartRepairTarget())
	const { data: dashboardsData, isLoading: isLoadingDashboards } = useGetLiteDashboards()
	const dashboards = dashboardsData ?? EMPTY_DASHBOARDS

	const configName = getConfigName(chartConfig, llamaAIChart)
	const [search, setSearch] = useState('')
	const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(repairTarget?.dashboardId ?? null)
	const [isCreatingNew, setIsCreatingNew] = useState(false)
	const [newDashboardNameInput, setNewDashboardNameInput] = useState('')
	const chartNameInputId = useId()
	const deferredSearch = useDeferredValue(search)

	const filteredDashboards = useMemo(() => {
		if (repairTarget) return dashboards.filter((dashboard) => dashboard.id === repairTarget.dashboardId)
		const query = deferredSearch.trim()
		if (!query) return dashboards
		return matchSorter(dashboards, query, {
			keys: ['name'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [dashboards, deferredSearch, repairTarget])

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
				...(llamaAIChart === undefined ? {} : { llamaAIChart }),
				configName,
				dashboardNameById,
				dashboardSlugById,
				variables,
				repairTarget
			})
		},
		onSuccess: (result) => {
			if (result.repaired) {
				clearChartRepairTarget()
				setRepairTarget(null)
			}
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
			<form onSubmit={handleAdd} className="flex min-h-0 flex-auto flex-col">
				<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<DialogHeading>{repairTarget ? 'Replace Dashboard Chart' : 'Add to Dashboard'}</DialogHeading>
					<DialogCloseButton className="-mr-1" />
				</div>

				<div className="flex min-h-0 flex-auto flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-3">
					{!repairTarget ? (
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
					) : null}

					<div className="max-h-56 overflow-y-auto overscroll-contain">
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

					{!repairTarget ? (
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
					) : null}

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
						<div className="rounded-lg border border-medium bg-surface-elevated-1 px-3 py-2">
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
							<LoadingSpinner size={16} />
						) : (
							<>
								<Icon name={repairTarget ? 'repeat' : 'plus'} className="size-3.5" />
								{repairTarget ? 'Replace Chart' : 'Add to Dashboard'}
							</>
						)}
					</Button>
				</div>
			</form>
		</Ariakit.Dialog>
	)
}
