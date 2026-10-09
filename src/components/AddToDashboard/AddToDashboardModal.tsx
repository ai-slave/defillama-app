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
import { getChartMetricLabel } from '~/containers/RWA/chartState'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { keepFocus, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { ListRow } from '~/ui/ListRow'
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
	if (config.kind === 'rwa-overview') {
		const label = `RWA ${getChartMetricLabel(config.metric)}`
		return config.chain ? `${config.chain} ${label}` : label
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
	const targetErrorId = `${useId()}-error`
	const [submitted, setSubmitted] = useState(false)
	// Kept while a retry runs: the mutation clears its own error when the retry starts.
	const [submitError, setSubmitError] = useState<string | null>(null)
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
	// The button gives way to the name field it asks for. The new field is a new question, so it opens without the last
	// submit's errors; they return on the next submit.
	const handleCreateNew = () =>
		keepFocus(
			() => {
				setTarget({ kind: 'new', name: '' })
				setSubmitted(false)
			},
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
		data: added,
		reset: resetSubmit
	} = useMutation({
		mutationFn: (variables: { target: DraftTarget; chartName: string }) =>
			submitAddToDashboard({ authorizedFetch, chartConfig, llamaAIChart, configName, ...variables, repairTarget }),
		onError: (error, variables) =>
			setSubmitError(
				error.message || (variables.target.kind === 'new' ? 'Failed to create dashboard' : 'Failed to add chart')
			),
		onSuccess: (result) => {
			setSubmitError(null)
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
		added?.activation.status === 'needs-confirmation' ? { added, activation: added.activation } : null

	if (!isAuthenticated || !hasActiveSubscription) {
		return null
	}

	const targetError = submitted && target === null ? 'Choose a dashboard or create a new one.' : null
	const nameError = target?.kind === 'new' && !target.name.trim() ? 'Enter a name for the new dashboard.' : null

	const handleAdd = (event: FormSubmitEvent) => {
		event.preventDefault()
		if (isSubmitting) return
		if (target === null || nameError) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		const chartName = String(new FormData(event.currentTarget).get('chartName') ?? '').trim()
		submitAddToDashboardMutation({ target, chartName })
	}

	return (
		<Dialog size="sm" fullSheet store={dialogStore} pending={isSubmitting} unmountOnHide portal>
			<form noValidate onSubmit={handleAdd} className="flex min-h-0 flex-auto flex-col">
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

					{/* The choice has no visible label of its own (the search field above names it), so the group is wired
					    by hand: showFieldErrors focuses its first dashboard, or Create new dashboard when there is none. */}
					<div
						role="group"
						aria-label="Dashboards"
						aria-describedby={targetError ? targetErrorId : undefined}
						data-invalid={targetError ? '' : undefined}
						className="flex flex-col gap-4"
					>
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
											<ListRow
												key={dashboard.id}
												selected={isSelected}
												aria-pressed={isSelected}
												onClick={() => handleSelectDashboard(dashboard)}
											>
												<span className="mr-auto truncate">{dashboard.name}</span>
												<Icon name="check" className={`size-4 shrink-0 text-link ${isSelected ? '' : 'invisible'}`} />
											</ListRow>
										)
									})}
								</div>
							)}
						</div>

						{dashboardsFailed ? (
							<InlineStatus
								variant="error"
								action={
									<Button
										type="button"
										size="sm"
										onClick={() => void refetchDashboards()}
										pendingLabel={isFetchingDashboards ? 'Retrying…' : null}
									>
										Try again
									</Button>
								}
							>
								{dashboards.length > 0 ? "Couldn't refresh your dashboards." : "Couldn't load your dashboards."}
							</InlineStatus>
						) : null}

						{repairTarget ? null : target?.kind === 'new' ? (
							<Field label="New dashboard name" error={submitted ? nameError : null}>
								{(control) => (
									<Input
										{...control}
										ref={newDashboardNameRef}
										type="text"
										name="newDashboardName"
										required
										value={target.name}
										onChange={(e) => setTarget({ kind: 'new', name: e.target.value })}
										placeholder="e.g. Stablecoin research"
										className="w-full"
									/>
								)}
							</Field>
						) : (
							<div className="flex flex-col gap-1">
								<Button type="button" size="md" onClick={handleCreateNew} className="w-full">
									<Icon name="plus" className="size-3.5" />
									<span>Create new dashboard</span>
								</Button>
								{targetError ? (
									<p id={targetErrorId} className="body-sm text-error">
										{targetError}
									</p>
								) : null}
							</div>
						)}
					</div>

					{chartConfig && (chartConfig.kind === 'multi' || chartConfig.kind === 'builder') ? (
						<div className="border-t border-subtle pt-4">
							<Field label="Chart name">
								{(control) => (
									<Input
										{...control}
										type="text"
										name="chartName"
										defaultValue={configName}
										placeholder={configName || 'Enter chart name…'}
										className="w-full"
									/>
								)}
							</Field>
						</div>
					) : null}

					{unsupportedMetrics.length > 0 ? (
						<InlineStatus variant="warning">
							{unsupportedMetrics.length} metric{unsupportedMetrics.length > 1 ? 's' : ''} not supported:{' '}
							{unsupportedMetrics.join(', ')}
						</InlineStatus>
					) : null}

					{submitError ? <InlineStatus variant="error">{submitError}</InlineStatus> : null}
				</DialogBody>

				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button
						type="submit"
						variant="primary"
						size="md"
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
					onClose={() => finish(costConfirmation.added, 'declined')}
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
							onSuccess: () => finish(costConfirmation.added, 'active')
						})
					}
				/>
			) : null}
		</Dialog>
	)
}
