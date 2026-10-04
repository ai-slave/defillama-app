import * as Ariakit from '@ariakit/react'
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useRouter } from 'next/router'
import {
	startTransition,
	type KeyboardEvent,
	useCallback,
	useDeferredValue,
	useId,
	useMemo,
	useRef,
	useState
} from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import {
	clearChartRepairTarget,
	readChartRepairTarget,
	type ChartRepairTarget
} from '~/containers/LlamaAI/chartRepairTarget'
import {
	activateDashboardArtifacts,
	buildLlamaAIChartDashboardItem,
	prepareStoredDashboardActivation,
	tryActivateDashboardArtifacts
} from '~/containers/LlamaAI/dashboardArtifactFlow'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import { useGetLiteDashboards } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { dashboardAPI, type LiteDashboardSummary } from '~/containers/ProDashboard/services/DashboardAPI'
import { addItemToDashboard, replaceItemInDashboard } from '~/containers/ProDashboard/utils/dashboardItemsUtils'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatUsd } from '~/utils/numberFormat'
import type { DashboardChartConfig, LlamaAIChartInput } from './addToDashboardContract'

const EMPTY_UNSUPPORTED_METRICS: Array<string> = []

interface AddToDashboardModalProps {
	dialogStore: Ariakit.DialogStore
	chartConfig: DashboardChartConfig | null
	llamaAIChart?: LlamaAIChartInput | null
	unsupportedMetrics?: Array<string>
}

type DraftTarget = { kind: 'existing'; id: string; name: string; slug?: string } | { kind: 'new'; name: string }

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
			chainMcaps: 'By chain',
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

type ActivationPlan = ReturnType<typeof prepareStoredDashboardActivation>

interface AddToDashboardMutationResult {
	href: string
	target: { kind: 'new' } | { kind: 'existing'; name: string; repaired: boolean }
	/** The chart is saved either way. A premium refresh the account has not accepted yet waits for the reader. */
	activation:
		| { status: 'active' | 'pending' }
		| { status: 'needs-confirmation'; dashboardId: string; plan: ActivationPlan }
}

function addedMessage(result: AddToDashboardMutationResult, activation: 'active' | 'declined' | 'pending'): string {
	const { target } = result
	if (target.kind === 'new') {
		if (activation === 'active') return 'Dashboard created!'
		if (activation === 'declined') return 'Dashboard created. Daily refresh was not enabled.'
		return 'Dashboard created, but refresh setup is pending. The current snapshot is safe.'
	}
	if (activation === 'active') return target.repaired ? `Replaced chart in ${target.name}!` : `Added to ${target.name}!`
	if (activation === 'declined') return `Added to ${target.name}. Daily refresh was not enabled.`
	return `Added to ${target.name}, but refresh setup is pending. The current snapshot is safe.`
}

function requireAuthorizedFetch(authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch']) {
	return async (url: string, options?: RequestInit): Promise<Response> => {
		const response = await authorizedFetch(url, options)
		if (!response) throw new Error('Authentication is required to activate dashboard refreshes')
		return response
	}
}

async function activateAddedLlamaAIChart(
	authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch'],
	dashboard: Dashboard
): Promise<AddToDashboardMutationResult['activation']> {
	// Refresh policies belong to the creator; a teammate's chart is stored as a pinned snapshot by design.
	if (dashboard.access && dashboard.access.role !== 'owner') return { status: 'active' }
	const plan = prepareStoredDashboardActivation(dashboard.data.items)
	const status = await tryActivateDashboardArtifacts(requireAuthorizedFetch(authorizedFetch), dashboard.id, plan)
	return status === 'needs-confirmation' ? { status, dashboardId: dashboard.id, plan } : { status }
}

function buildChartToAdd(
	chartConfig: DashboardChartConfig | null,
	llamaAIChart: LlamaAIChartInput | null | undefined,
	configName: string,
	chartName: string
): DashboardItemConfig | null {
	if (llamaAIChart) return buildLlamaAIChartDashboardItem(llamaAIChart)
	if (!chartConfig) return null
	if (chartConfig.kind === 'multi' || chartConfig.kind === 'builder') {
		return { ...chartConfig, name: chartName || configName }
	}
	return { ...chartConfig }
}

interface SubmitAddToDashboardParams {
	authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch']
	chartConfig: DashboardChartConfig | null
	llamaAIChart: LlamaAIChartInput | null | undefined
	configName: string
	target: DraftTarget
	chartName: string
	repairTarget: ChartRepairTarget | null
}

async function submitAddToDashboard({
	authorizedFetch,
	chartConfig,
	llamaAIChart,
	configName,
	target,
	chartName,
	repairTarget
}: SubmitAddToDashboardParams): Promise<AddToDashboardMutationResult> {
	const chartToAdd = buildChartToAdd(chartConfig, llamaAIChart, configName, chartName)
	if (!chartToAdd) {
		throw new Error('No chart to add')
	}

	if (target.kind === 'new') {
		const dashboard = await dashboardAPI.createDashboard(
			{
				items: [chartToAdd],
				dashboardName: target.name.trim(),
				timePeriod: '90d',
				visibility: 'private',
				tags: [],
				description: ''
			},
			authorizedFetch
		)
		return {
			href: `/pro/${dashboard.slug || dashboard.id}`,
			target: { kind: 'new' },
			activation: llamaAIChart ? await activateAddedLlamaAIChart(authorizedFetch, dashboard) : { status: 'active' }
		}
	}

	const repaired = repairTarget?.dashboardId === target.id
	const dashboard = repaired
		? await replaceItemInDashboard(target.id, repairTarget.itemId, chartToAdd, authorizedFetch)
		: await addItemToDashboard(target.id, chartToAdd, authorizedFetch)
	return {
		href: `/pro/${target.slug || target.id}`,
		target: { kind: 'existing', name: target.name, repaired },
		activation: llamaAIChart ? await activateAddedLlamaAIChart(authorizedFetch, dashboard) : { status: 'active' }
	}
}

export function AddToDashboardModal(props: AddToDashboardModalProps) {
	// The store outlives the dialog, so each opening remounts the draft: search, pick and new name start empty.
	const openingKey = useOpeningKey(Ariakit.useStoreState(props.dialogStore, 'open'))
	return <AddToDashboardDialog key={openingKey} {...props} />
}

function AddToDashboardDialog({
	dialogStore,
	chartConfig,
	llamaAIChart,
	unsupportedMetrics = EMPTY_UNSUPPORTED_METRICS
}: AddToDashboardModalProps) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { authorizedFetch, isAuthenticated, hasActiveSubscription } = useAuthContext()
	const [repairTarget, setRepairTarget] = useState<ChartRepairTarget | null>(() => readChartRepairTarget())
	const {
		data: dashboards,
		isLoading: isLoadingDashboards,
		failed: dashboardsFailed,
		isFetching: isFetchingDashboards,
		refetch: refetchDashboards
	} = useGetLiteDashboards()

	const configName = getConfigName(chartConfig, llamaAIChart)
	const [search, setSearch] = useState('')
	const [picked, setTarget] = useState<DraftTarget | null>(null)
	// A repair always targets its own dashboard, read from the list as it loads.
	const repairDashboard = repairTarget ? dashboards.find((item) => item.id === repairTarget.dashboardId) : undefined
	const target: DraftTarget | null = repairTarget
		? {
				kind: 'existing',
				id: repairTarget.dashboardId,
				name: repairDashboard?.name ?? 'dashboard',
				slug: repairDashboard?.slug
			}
		: picked
	const chartNameInputId = useId()
	const newDashboardNameInputId = useId()
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

	const handleSelectDashboard = useCallback((dashboard: LiteDashboardSummary) => {
		startTransition(() => setTarget({ kind: 'existing', id: dashboard.id, name: dashboard.name, slug: dashboard.slug }))
	}, [])

	const newDashboardNameRef = useRef<HTMLInputElement>(null)
	// The button gives way to the name field it asks for.
	const handleCreateNew = () =>
		keepFocus(
			() => setTarget({ kind: 'new', name: '' }),
			() => newDashboardNameRef.current
		)

	const handleSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault()
		}
	}, [])

	const {
		mutate: submitAddToDashboardMutation,
		isPending: isSubmitting,
		error: submitError,
		variables: submitVariables,
		data: submitted,
		reset: resetSubmit
	} = useMutation({
		mutationFn: (variables: { target: DraftTarget; chartName: string }) =>
			submitAddToDashboard({ authorizedFetch, chartConfig, llamaAIChart, configName, ...variables, repairTarget }),
		onSuccess: (result) => {
			if (result.target.kind === 'existing' && result.target.repaired) {
				clearChartRepairTarget()
				setRepairTarget(null)
			}
			invalidateDashboardQueries(queryClient)
			trackUmamiEvent('dashboard-add-chart-submit', {
				type: result.target.kind === 'new' ? 'new-dashboard' : 'existing-dashboard'
			})
			if (result.activation.status !== 'needs-confirmation') finish(result, result.activation.status)
		}
	})
	// Hide first, so the toast never sits over the dialog. Clearing the result closes the cost confirmation with it.
	const finish = (result: AddToDashboardMutationResult, activation: 'active' | 'declined' | 'pending') => {
		resetSubmit()
		dialogStore.hide()
		showViewToast(addedMessage(result, activation), result.href, router.push)
	}

	// The chart is already saved, so this only starts the refreshes at the ceiling the reader accepted.
	const confirmedActivation = useMutation({
		mutationFn: ({ dashboardId, plan }: { dashboardId: string; plan: ActivationPlan }) =>
			activateDashboardArtifacts(requireAuthorizedFetch(authorizedFetch), dashboardId, plan, plan.estimatedMaxCostUsd)
	})
	const costConfirmation =
		submitted?.activation.status === 'needs-confirmation' ? { submitted, activation: submitted.activation } : null

	if (!isAuthenticated || !hasActiveSubscription) {
		return null
	}

	const blockedReason =
		target === null
			? 'Pick a dashboard or create a new one'
			: target.kind === 'new' && !target.name.trim()
				? 'Enter a name for the new dashboard'
				: null

	// The submit button stays disabled while blockedReason is set, so a submit always has a complete target.
	const handleAdd = (event: FormSubmitEvent) => {
		event.preventDefault()
		const chartName = String(new FormData(event.currentTarget).get('chartName') ?? '').trim()
		submitAddToDashboardMutation({ target: target!, chartName })
	}

	return (
		<Dialog size="sm" fullSheet store={dialogStore} pending={isSubmitting} unmountOnHide portal>
			<form onSubmit={handleAdd} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title={repairTarget ? 'Replace dashboard chart' : 'Add to dashboard'} />

				<DialogBody>
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
								placeholder="Search dashboards…"
								className="w-full pl-8"
							/>
						</label>
					) : null}

					<div className="max-h-56 overflow-y-auto overscroll-contain">
						{isLoadingDashboards ? (
							<div role="status" aria-live="polite" className="flex items-center justify-center py-8">
								<LoadingIndicator label="Loading dashboards" />
							</div>
						) : filteredDashboards.length === 0 && !search.trim() ? (
							dashboardsFailed ? null : (
								<p role="status" aria-live="polite" className="py-6 text-center body-sm text-tertiary">
									No dashboards yet
								</p>
							)
						) : filteredDashboards.length === 0 ? (
							<p role="status" aria-live="polite" className="py-6 text-center body-sm text-tertiary">
								No matches found
							</p>
						) : (
							<div className="flex flex-col gap-0.5">
								{filteredDashboards.map((dashboard: (typeof dashboards)[number]) => {
									const isSelected = target?.kind === 'existing' && target.id === dashboard.id
									return (
										<button
											key={dashboard.id}
											type="button"
											aria-pressed={isSelected}
											onClick={() => handleSelectDashboard(dashboard)}
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

					{dashboardsFailed ? (
						<InlineStatus variant="error">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span>
									{dashboards.length > 0 ? "Couldn't refresh your dashboards." : "Couldn't load your dashboards."}
								</span>
								<Button
									type="button"
									size="sm"
									onClick={() => void refetchDashboards()}
									pendingLabel={isFetchingDashboards ? 'Retrying…' : null}
								>
									Try again
								</Button>
							</div>
						</InlineStatus>
					) : null}

					{!repairTarget ? (
						<div>
							{target?.kind === 'new' ? (
								<>
									<label htmlFor={newDashboardNameInputId} className="mb-1.5 block label-sm text-secondary">
										New dashboard name
									</label>
									<Input
										ref={newDashboardNameRef}
										id={newDashboardNameInputId}
										type="text"
										name="newDashboardName"
										required
										onChange={(e) => setTarget({ kind: 'new', name: e.target.value })}
										placeholder="e.g. Stablecoin research"
										className="w-full"
									/>
								</>
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
							<label htmlFor={chartNameInputId} className="mb-1.5 block label-sm text-secondary">
								Chart name
							</label>
							<Input
								id={chartNameInputId}
								type="text"
								name="chartName"
								defaultValue={configName}
								placeholder={configName || 'Enter chart name…'}
								className="w-full"
							/>
						</div>
					) : null}

					{unsupportedMetrics.length > 0 ? (
						<InlineStatus variant="warning">
							{unsupportedMetrics.length} metric{unsupportedMetrics.length > 1 ? 's' : ''} not supported:{' '}
							{unsupportedMetrics.join(', ')}
						</InlineStatus>
					) : null}

					{submitError ? (
						<InlineStatus variant="error">
							{submitError.message ||
								(submitVariables?.target.kind === 'new' ? 'Failed to create dashboard' : 'Failed to add chart')}
						</InlineStatus>
					) : null}
				</DialogBody>

				<DialogFooter
					leading={blockedReason ? <p className="body-sm text-tertiary">{blockedReason}</p> : null}
					dismiss={<DialogCancelButton />}
				>
					<Button
						type="submit"
						variant="primary"
						size="md"
						disabled={blockedReason !== null}
						pendingLabel={isSubmitting ? (repairTarget ? 'Replacing…' : 'Adding…') : null}
					>
						<Icon name={repairTarget ? 'repeat' : 'plus'} className="size-3.5" />
						{repairTarget ? 'Replace chart' : 'Add to dashboard'}
					</Button>
				</DialogFooter>
			</form>
			{costConfirmation ? (
				<ConfirmDialog
					open
					// Skipping keeps the saved chart as a snapshot; the add itself is done either way.
					onClose={() => finish(costConfirmation.submitted, 'declined')}
					portal
					tone="primary"
					title="Enable daily refresh?"
					description={`This dashboard uses premium data. Daily refreshes will bill your account up to ${formatUsd(costConfirmation.activation.plan.estimatedMaxCostUsd, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} per refresh window.`}
					confirmLabel="Enable daily refresh"
					cancelLabel="Skip"
					pendingLabel={confirmedActivation.isPending ? 'Enabling…' : null}
					error={
						confirmedActivation.isError
							? "Couldn't enable daily refresh. Try again, or skip to keep the current snapshot."
							: null
					}
					onConfirm={() =>
						confirmedActivation.mutate(costConfirmation.activation, {
							onSuccess: () => finish(costConfirmation.submitted, 'active')
						})
					}
				/>
			) : null}
		</Dialog>
	)
}
