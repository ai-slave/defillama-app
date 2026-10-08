import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { memo, useRef, useState, type Ref, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import {
	applyAlertUpdateToList,
	execChipLabel,
	execChipTone,
	formatPriceAlertSummary,
	formatTokenLabel,
	getAlertsAccessState,
	isAlertsUpsellActive,
	isFiredOneTimePriceAlert
} from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import {
	deleteAlert,
	fetchAlertExecutionDetail,
	fetchAlertExecutions,
	fetchAlerts,
	setAlertEnabled,
	updateAlert
} from '~/containers/LlamaAI/components/alerts/api'
import {
	deriveAlertTitle,
	getDeliveryError,
	getSlackListGate,
	getUpsellCopy,
	type TriggerType
} from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { EmptyAlertsState } from '~/containers/LlamaAI/components/alerts/EmptyAlertsState'
import { PriceAlertEditor } from '~/containers/LlamaAI/components/alerts/PriceAlertEditor'
import { ALERTS_QUERY_KEY } from '~/containers/LlamaAI/components/alerts/queryKeys'
import {
	DAYS_OF_WEEK,
	formatScheduleExpression,
	getTimezoneLabel,
	getUserTimezone,
	GMT_OFFSETS,
	parseScheduleExpression
} from '~/containers/LlamaAI/components/alerts/schedule'
import type {
	Alert,
	AlertExecution,
	AlertExecutionDetail,
	AlertsUsage,
	DeliveryChannel,
	PriceTrigger,
	UpdateAlertInput
} from '~/containers/LlamaAI/components/alerts/types'
import {
	alertFieldLabelClass,
	AlertsHeaderIcon,
	SegmentedToggle,
	DELIVERY_OPTIONS,
	StatusChip,
	SettingsIntegrationsLink
} from '~/containers/LlamaAI/components/alerts/ui'
import { CreateAlertModal } from '~/containers/LlamaAI/components/CreateAlertModal'
import { ChatMarkdownRenderer, SourcesList } from '~/containers/LlamaAI/components/markdown/ChatMarkdownRenderer'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { SESSIONS_QUERY_KEY } from '~/containers/LlamaAI/hooks/useSessionList'
import { useSlackChannels } from '~/containers/LlamaAI/hooks/useSlackChannels'
import { useSlackWorkspaces } from '~/containers/LlamaAI/hooks/useSlackIntegrationLink'
import { prepareAlertSummaryMarkdown, sanitizeUrl } from '~/containers/LlamaAI/utils/markdownHelpers'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogDiscardGuard, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { Field, FieldGroup } from '~/ui/Field'
import { keepFocus, showFieldErrors, takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { RelativeTime } from '~/ui/RelativeTime'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatFixedNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { RetryNotice } from './RetryNotice'

const NO_EDITED_ALERTS: ReadonlySet<string> = new Set()

interface AlertsModalProps {
	dialogStore: Ariakit.DialogStore
	alertsUsage?: AlertsUsage | null
	onPrefillPrompt?: (text: string) => void
}

function getAlertsSubtitle(alertsUsage: AlertsUsage | null | undefined, alertCount: number | undefined): string {
	if (alertsUsage && alertsUsage.cap !== null) {
		return `${alertsUsage.count} of ${alertsUsage.cap} alerts on your plan`
	}
	if (typeof alertCount === 'number' && alertCount > 0) {
		return `${alertCount} ${alertCount === 1 ? 'alert' : 'alerts'} set up`
	}
	return 'Scheduled reports and price triggers'
}

export const AlertsModal = memo(function AlertsModal({ dialogStore, alertsUsage, onPrefillPrompt }: AlertsModalProps) {
	const { authorizedFetch, isAuthenticated, loaders, user } = useAuthContext()
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')
	const alertsQueryKey = [ALERTS_QUERY_KEY, user?.id ?? null]
	const createModalStore = Ariakit.useDialogStore()
	const signInModalStore = Ariakit.useDialogStore()
	const [createTab, setCreateTab] = useState<TriggerType>('schedule')
	// Alerts whose open editor has changes: closing the dialog would drop them. The rows unmount with a closed dialog
	// without reporting, so the set belongs to one opening and each opening starts empty.
	const openingKey = useOpeningKey(isOpen)
	const [edited, setEdited] = useState<{ opening: number; ids: ReadonlySet<string> }>({ opening: 0, ids: new Set() })
	const editedAlertIds = edited.opening === openingKey ? edited.ids : NO_EDITED_ALERTS
	const markEdited = (alertId: string, isEdited: boolean) =>
		setEdited((current) => {
			const ids = current.opening === openingKey ? current.ids : NO_EDITED_ALERTS
			if (ids.has(alertId) === isEdited) return current
			const next = new Set(ids)
			if (isEdited) next.add(alertId)
			else next.delete(alertId)
			return { opening: openingKey, ids: next }
		})
	const upsellActive = isAlertsUpsellActive(alertsUsage)
	const accessState = getAlertsAccessState(isAuthenticated, loaders.userLoading)

	const openCreateModal = (tab: TriggerType) => {
		setCreateTab(tab)
		createModalStore.show()
	}

	const handleChipSelect = (text: string, variant: 'static' | 'freeform') => {
		trackUmamiEvent('llamaai-alert-chip-prefill', { variant })
		dialogStore.hide()
		onPrefillPrompt?.(text)
	}

	const handleJustAsk = (exampleText: string) => {
		dialogStore.hide()
		onPrefillPrompt?.(exampleText)
	}

	const alertsQuery = useQuery<Array<Alert>>({
		queryKey: alertsQueryKey,
		queryFn: () => fetchAlerts(authorizedFetch),
		enabled: isOpen && isAuthenticated && !!user
	})

	const { data: alerts, isFetching: isFetchingAlerts, refetch: refetchAlerts } = alertsQuery
	const alertsFailed = queryReadFailed(alertsQuery)

	const view =
		accessState !== 'ready'
			? accessState
			: alerts && alerts.length > 0
				? 'list'
				: alertsFailed
					? 'error'
					: alertsQuery.isLoading
						? 'loading'
						: upsellActive
							? 'upsell'
							: 'empty'
	const footerAction =
		view === 'sign-in' ? (
			<Button type="button" variant="primary" size="md" onClick={signInModalStore.show}>
				Sign in
			</Button>
		) : view === 'upsell' || (view === 'list' && upsellActive) ? (
			<Button as={BasicLink} href="/subscription" variant="primary" size="md">
				Upgrade to Pro
			</Button>
		) : view === 'list' ? (
			<Button type="button" variant="primary" size="md" onClick={() => openCreateModal('schedule')}>
				<Icon name="plus" className="size-3.5" />
				New alert
			</Button>
		) : null

	return (
		<>
			<Ariakit.DialogProvider store={dialogStore}>
				<Dialog size="md" fullSheet portal unmountOnHide>
					<DialogHeader
						title="Alerts"
						subtitle={getAlertsSubtitle(alertsUsage, alerts?.length)}
						leading={<AlertsHeaderIcon />}
					/>
					<DialogDiscardGuard
						when={editedAlertIds.size > 0}
						title="Discard alert changes?"
						description="Your edits to the alert are not saved."
					/>
					{view === 'empty' ? (
						<DialogBody kind="flush">
							<EmptyAlertsState onOpenCreate={openCreateModal} onChipSelect={handleChipSelect} />
						</DialogBody>
					) : view === 'list' ? (
						<DialogBody kind="list">
							<div className="flex flex-col gap-2">
								{alertsFailed ? (
									<RetryNotice
										message="Couldn't load alerts."
										retrying={isFetchingAlerts}
										onRetry={() => void refetchAlerts()}
									/>
								) : null}
								{upsellActive ? (
									<InlineStatus variant="warning">
										{getUpsellCopy(alertsUsage ?? null)}. Upgrade to Pro to create more alerts.
									</InlineStatus>
								) : null}
								{alerts!.map((alert) => (
									<AlertRow key={alert.id} alert={alert} markEdited={markEdited} />
								))}
							</div>
						</DialogBody>
					) : (
						<DialogBody>
							{view === 'loading' ? (
								<div role="status" className="flex justify-center py-16">
									<LoadingIndicator label="Loading alerts" />
								</div>
							) : view === 'sign-in' ? (
								<p className="body-sm text-secondary">
									Sign in to use alerts and manage their delivery from one place.
								</p>
							) : view === 'error' ? (
								<RetryNotice
									message="Couldn't load alerts."
									retrying={isFetchingAlerts}
									onRetry={() => void refetchAlerts()}
								/>
							) : (
								<p className="body-sm text-secondary">
									{getUpsellCopy(alertsUsage ?? null)}. Upgrade to Pro to create alerts.
								</p>
							)}
						</DialogBody>
					)}
					{footerAction ? <DialogFooter>{footerAction}</DialogFooter> : null}
				</Dialog>
			</Ariakit.DialogProvider>
			<SignInModal store={signInModalStore} prompt="Sign in to create alerts and manage their delivery" />
			<CreateAlertModal dialogStore={createModalStore} initialTab={createTab} onJustAsk={handleJustAsk} />
		</>
	)
})

interface AlertRowProps {
	alert: Alert
	markEdited: (alertId: string, edited: boolean) => void
}

function AlertCard({ ref, children }: { ref: Ref<HTMLDivElement>; children: React.ReactNode }) {
	return (
		<div ref={ref} className="rounded-lg border border-subtle bg-surface px-4 py-3.5">
			{children}
		</div>
	)
}

const formatExecDate = (iso: string) => {
	const d = new Date(iso)
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${formatFixedNumber(ms / 1000, 1)}s`)

const priceAlertTitle = (trigger: PriceTrigger) =>
	deriveAlertTitle({
		triggerType: 'price',
		prompt: '',
		symbol: formatTokenLabel(trigger.token_nk),
		op: trigger.op,
		value: String(trigger.value)
	})

const AlertRow = memo(function AlertRow({ alert, markEdited }: AlertRowProps) {
	const { authorizedFetch, user } = useAuthContext()
	const queryClient = useQueryClient()
	const isPriceAlert = alert.trigger?.type === 'price'
	// Gone once the Alerts dialog closes: a request that fails after that can only report itself in a toast.
	const cardRef = useRef<HTMLDivElement>(null)
	const editButtonRef = useRef<HTMLButtonElement>(null)
	const actionsMenuButtonRef = useRef<HTMLButtonElement>(null)
	// 'rearmed' is the editor opened by Re-arm, which also explains that the alert may fire again at once.
	const [mode, setMode] = useState<'view' | 'editing' | 'rearmed' | 'deleting'>('view')
	const editing = mode === 'editing' || mode === 'rearmed'
	const [showExecutions, setShowExecutions] = useState(false)
	const [selectedExecId, setSelectedExecId] = useState<string | null>(null)
	const alertsQueryKey = [ALERTS_QUERY_KEY, user?.id ?? null]

	const executionsQuery = useQuery<Array<AlertExecution>>({
		queryKey: [ALERTS_QUERY_KEY, alert.id, 'executions'],
		queryFn: () => fetchAlertExecutions(authorizedFetch, alert.id),
		enabled: showExecutions
	})

	const execDetailQuery = useQuery<AlertExecutionDetail>({
		queryKey: [ALERTS_QUERY_KEY, alert.id, 'executions', selectedExecId],
		queryFn: () => fetchAlertExecutionDetail(authorizedFetch, alert.id, selectedExecId!),
		enabled: !!selectedExecId
	})

	const handleToggleExecutions = () => {
		const next = !showExecutions
		setShowExecutions(next)
		if (!next) setSelectedExecId(null)
	}

	const toggleAlertMutation = useMutation<
		boolean,
		Error,
		{ alertId: string; enabled: boolean },
		{ previousEnabled: boolean | undefined }
	>({
		mutationKey: alertsQueryKey,
		mutationFn: ({ alertId, enabled }: { alertId: string; enabled: boolean }) =>
			setAlertEnabled(authorizedFetch, alertId, enabled),
		onMutate: async ({ alertId, enabled }) => {
			await queryClient.cancelQueries({ queryKey: alertsQueryKey })
			const previous = queryClient.getQueryData<Array<Alert>>(alertsQueryKey)
			queryClient.setQueryData(alertsQueryKey, (old: Array<Alert> | undefined) => {
				if (!old) return []
				return old.map((item) => (item.id === alertId ? { ...item, enabled } : item))
			})
			return { previousEnabled: previous?.find((item) => item.id === alertId)?.enabled }
		},
		onError: (_error, { alertId, enabled }, context) => {
			if (!cardRef.current?.isConnected)
				toast.error(`Couldn't ${enabled ? 'resume' : 'pause'} “${alert.title}”. Try again.`)
			const previousEnabled = context?.previousEnabled
			if (previousEnabled === undefined) return
			// A failed toggle must not roll back changes to other alert rows.
			queryClient.setQueryData<Array<Alert>>(alertsQueryKey, (current) =>
				current?.map((item) => (item.id === alertId ? { ...item, enabled: previousEnabled } : item))
			)
		},
		onSettled: () => {
			// Refetch after the last toggle so another row keeps its pending state.
			if (queryClient.isMutating({ mutationKey: alertsQueryKey }) > 1) return
			void queryClient.invalidateQueries({ queryKey: [ALERTS_QUERY_KEY] })
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})

	// The row stays until the server confirms: removing it first unmounted the confirmation, so a failed delete
	// restored the row with no error to show.
	const deleteAlertMutation = useMutation<string, Error, string>({
		mutationFn: (alertId: string) => deleteAlert(authorizedFetch, alertId),
		onSuccess: (alertId) => {
			queryClient.setQueryData<Array<Alert>>(alertsQueryKey, (old) => old?.filter((item) => item.id !== alertId))
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: [ALERTS_QUERY_KEY] })
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})

	// The delete confirmation's failure, not the mutation's error: that one clears as soon as a retry starts.
	const [deleteFailed, setDeleteFailed] = useState(false)

	const switchMode = (next: typeof mode) => {
		if (!toggleAlertMutation.isPending) toggleAlertMutation.reset()
		if (!deleteAlertMutation.isPending) deleteAlertMutation.reset()
		setDeleteFailed(false)
		setMode(next)
		markEdited(alert.id, false)
	}

	// Closing the editor removes the control that had focus; the row's Edit toggle, or its actions menu on phones, takes it.
	const closeEditor = () =>
		keepFocus(
			() => switchMode('view'),
			() => (editButtonRef.current?.checkVisibility() ? editButtonRef.current : actionsMenuButtonRef.current)
		)

	const handleRearm = () => {
		if (toggleAlertMutation.isPending) return
		trackUmamiEvent('llamaai-alert-rearm')
		switchMode('rearmed')
		toggleAlertMutation.mutate({ alertId: alert.id, enabled: true })
	}
	// The Re-arm button leaves once the alert re-arms, and the menu item closes its menu; the editor it opens takes
	// focus now, which also keeps the closing menu from handing focus back to its button.
	const rearmIntoEditor = () => {
		flushSync(handleRearm)
		cardRef.current!.querySelector<HTMLInputElement>('input[name="title"]')!.focus()
	}

	const channelLabel =
		alert.delivery_channel === 'telegram'
			? 'Telegram'
			: alert.delivery_channel === 'slack'
				? alert.slack_channel_name
					? `Slack #${alert.slack_channel_name}`
					: 'Slack'
				: 'Email'

	const selectedExec = execDetailQuery.data
	const charts = selectedExec?.generated_charts || []
	// The run's detail covers the row without unmounting it, so an open editor keeps its draft.
	const execView = selectedExec ? (
		<div className="flex flex-col gap-3">
			<span className="self-start label-sm">
				<Button
					// Replaces the history row that opened it.
					autoFocus
					variant="link"
					// The run's row comes back with the history it was opened from.
					onClick={() =>
						keepFocus(
							() => setSelectedExecId(null),
							() => document.getElementById(`alert-run-${selectedExecId}`)
						)
					}
				>
					<Icon name="arrow-left" className="size-3.5" />
					Back to history
				</Button>
			</span>
			<div className="flex items-center justify-between">
				<span className="mono-sm text-tertiary">{formatExecDate(selectedExec.executed_at)}</span>
				<StatusChip tone={execChipTone(selectedExec.status, !!selectedExec.error_message)}>
					{execChipLabel(selectedExec.status)}
				</StatusChip>
			</div>
			{selectedExec.generated_summary ? (
				<div className="[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg">
					<ChatMarkdownRenderer
						content={prepareAlertSummaryMarkdown(selectedExec.generated_summary, charts)}
						messageId={selectedExec.id}
					/>
				</div>
			) : selectedExec.error_message ? (
				<p className="body-sm text-error">{selectedExec.error_message}</p>
			) : (
				<p className="body-sm text-tertiary">No content available.</p>
			)}
			{charts.length > 0
				? charts
						.filter((c) => sanitizeUrl(c.url) && !selectedExec.generated_summary?.includes(`[CHART:${c.id}]`))
						.map((c) => (
							<img
								key={c.id}
								src={sanitizeUrl(c.url)!}
								alt={c.title || 'Chart'}
								className="max-w-full self-start rounded-lg"
							/>
						))
				: null}
			{selectedExec.citations?.length ? (
				<div className="border-t border-subtle pt-3">
					<SourcesList citations={selectedExec.citations} />
				</div>
			) : null}
		</div>
	) : null

	const typeTileClass = !alert.enabled
		? 'bg-surface-elevated-2 text-tertiary'
		: isPriceAlert
			? 'bg-page text-secondary'
			: 'bg-brand-tint text-link'

	return (
		<AlertCard ref={cardRef}>
			{execView}
			<div hidden={!!selectedExec}>
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-1 items-start gap-3">
						<div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${typeTileClass}`}>
							<Icon name={isPriceAlert ? 'trending-up' : 'calendar'} className="size-4" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<h3 className="min-w-0 label-md break-words text-primary">{alert.title}</h3>
								{alert.last_run_status === 'error' ? <StatusChip tone="error">Error</StatusChip> : null}
								{!alert.enabled && !isFiredOneTimePriceAlert(alert) ? (
									<StatusChip tone="neutral">Paused</StatusChip>
								) : null}
							</div>
							<p className="mt-1 body-md text-secondary">
								{isPriceAlert && alert.trigger
									? formatPriceAlertSummary(alert.trigger, alert.enabled, alert.armed, alert.run_count)
									: formatScheduleExpression(alert.schedule_expression)}
							</p>
							{alert.condition ? <p className="mt-0.5 body-sm text-secondary">If: {alert.condition}</p> : null}
							<p className="mt-1 body-sm text-secondary">
								{channelLabel}
								{/* A paused alert's status chip already says so. */}
								{!isPriceAlert && alert.enabled ? (
									<>
										{' · '}
										<RelativeTime value={alert.next_run_at} prefix="Next run" pastLabel="soon" />
									</>
								) : null}
								{` · ${alert.run_count} ${alert.run_count === 1 ? 'run' : 'runs'}`}
							</p>
							{alert.last_run_status === 'error' && alert.last_error ? (
								<p className="mt-1 body-sm text-error">{alert.last_error}</p>
							) : null}
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-0.5">
						{isFiredOneTimePriceAlert(alert) ? (
							<button
								type="button"
								onClick={rearmIntoEditor}
								className="mr-1 hidden items-center gap-1 rounded-lg bg-warning-tint px-2 py-1 label-sm text-warning not-disabled:not-aria-disabled:hover:bg-warning-tint-strong sm:flex"
							>
								<Icon name="repeat" className="size-3" />
								Re-arm
							</button>
						) : null}
						<div className="hidden items-center gap-0.5 sm:flex">
							{alert.run_count > 0 ? (
								<Tooltip
									content="View history"
									render={
										<Button
											variant="ghost"
											size="md"
											square
											onClick={handleToggleExecutions}
											aria-pressed={showExecutions}
											aria-label={`View history of ${alert.title}`}
											data-active={showExecutions}
										/>
									}
								>
									<Icon name="clock" className="size-4" />
								</Tooltip>
							) : null}
							<Tooltip
								content="Edit"
								render={
									<Button
										ref={editButtonRef}
										variant="ghost"
										size="md"
										square
										onClick={() => switchMode(editing ? 'view' : 'editing')}
										aria-pressed={editing}
										aria-label={`Edit ${alert.title}`}
										data-active={editing}
									/>
								}
							>
								<Icon name="pencil" className="size-4" />
							</Tooltip>
							<Tooltip
								content="Delete"
								render={
									<Button
										variant="ghostDestructive"
										size="md"
										square
										onClick={() => switchMode('deleting')}
										aria-label={`Delete ${alert.title}`}
									/>
								}
							>
								<Icon name="trash-2" className="size-4" />
							</Tooltip>
						</div>
						<Ariakit.MenuProvider placement="bottom-end">
							<Ariakit.MenuButton
								ref={actionsMenuButtonRef}
								aria-label={`Actions for alert ${alert.title}`}
								render={<Button type="button" size="md" variant="ghost" square className="sm:hidden" />}
								data-active={showExecutions || editing}
							>
								<Icon name="ellipsis" height={16} width={16} />
							</Ariakit.MenuButton>
							<MenuSurface variant="actions" gutter={6}>
								{isFiredOneTimePriceAlert(alert) ? (
									<MenuItem onClick={rearmIntoEditor}>
										<Icon name="repeat" height={14} width={14} />
										Re-arm alert
									</MenuItem>
								) : null}
								{alert.run_count > 0 ? (
									<MenuItem onClick={handleToggleExecutions}>
										<Icon name="clock" height={14} width={14} />
										{showExecutions ? 'Hide history' : 'View history'}
									</MenuItem>
								) : null}
								<MenuItem onClick={() => switchMode(editing ? 'view' : 'editing')}>
									<Icon name="pencil" height={14} width={14} />
									{editing ? 'Cancel editing' : 'Edit alert'}
								</MenuItem>
								<MenuItem destructive onClick={() => switchMode('deleting')}>
									<Icon name="trash-2" height={14} width={14} />
									Delete alert
								</MenuItem>
							</MenuSurface>
						</Ariakit.MenuProvider>
						<div className="ml-1.5">
							<Switch
								label={`${alert.title} enabled`}
								hideLabel
								value={alert.id}
								checked={alert.enabled}
								isLoading={toggleAlertMutation.isPending}
								onChange={() => {
									trackUmamiEvent('llamaai-alert-toggle')
									if (isFiredOneTimePriceAlert(alert)) {
										handleRearm()
									} else {
										toggleAlertMutation.mutate({ alertId: alert.id, enabled: !alert.enabled })
									}
								}}
							/>
						</div>
					</div>
				</div>

				{toggleAlertMutation.isError ? (
					<div className="mt-2">
						<InlineStatus variant="error">Couldn't update the alert. Try again.</InlineStatus>
					</div>
				) : null}

				{mode === 'deleting' ? (
					<ConfirmDialog
						open
						onClose={() => switchMode('view')}
						title="Delete alert?"
						description={`“${alert.title}” stops running and its deliveries end. This can’t be undone.`}
						confirmLabel="Delete"
						pendingLabel={deleteAlertMutation.isPending ? 'Deleting…' : null}
						error={deleteFailed ? "Couldn't delete the alert. Try again." : null}
						onConfirm={() => {
							// A deleted row takes this confirmation and its trigger with it. The confirmation closes first, onto a
							// neighbouring row's switch; once no row is left, the dialog's net takes focus.
							const card = cardRef.current!
							const next =
								card.nextElementSibling?.querySelector<HTMLElement>('[role="switch"]') ??
								card.previousElementSibling?.querySelector<HTMLElement>('[role="switch"]')
							deleteAlertMutation.mutate(alert.id, {
								onSuccess: () =>
									keepFocus(
										() => switchMode('view'),
										() => next
									),
								onError: () => setDeleteFailed(true)
							})
						}}
					/>
				) : null}

				{showExecutions ? (
					<div className="mt-3 border-t border-subtle pt-3">
						<p className="mb-2 label-xs tracking-wide text-tertiary uppercase">History</p>
						{queryReadFailed(executionsQuery) ? (
							<RetryNotice
								message="Couldn't load alert history."
								retrying={executionsQuery.isFetching}
								onRetry={() => void executionsQuery.refetch()}
							/>
						) : executionsQuery.isLoading ? (
							<div role="status" className="flex justify-center py-4">
								<LoadingIndicator label="Loading history" />
							</div>
						) : !executionsQuery.data || executionsQuery.data.length === 0 ? (
							<p className="text-center body-sm text-tertiary">No runs yet.</p>
						) : (
							<div className="flex flex-col">
								{executionsQuery.data.map((exec) => (
									<Ariakit.Button
										key={exec.id}
										id={`alert-run-${exec.id}`}
										onClick={() => setSelectedExecId(exec.id)}
										accessibleWhenDisabled
										disabled={execDetailQuery.isLoading}
										className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left not-disabled:not-aria-disabled:hover:bg-hover-row"
									>
										<div className="flex items-baseline gap-2">
											<span className="mono-sm text-primary">{formatExecDate(exec.executed_at)}</span>
											<span className="label-xs text-tertiary">{formatDuration(exec.duration_ms)}</span>
										</div>
										<StatusChip tone={execChipTone(exec.status, !!exec.error_message)}>
											{execChipLabel(exec.status)}
										</StatusChip>
									</Ariakit.Button>
								))}
							</div>
						)}
						{queryReadFailed(execDetailQuery) ? (
							<RetryNotice
								message="Couldn't load this execution."
								retrying={execDetailQuery.isFetching}
								onRetry={() => void execDetailQuery.refetch()}
							/>
						) : execDetailQuery.isLoading ? (
							<div role="status" className="mt-2 flex justify-center">
								<LoadingIndicator label="Loading run" />
							</div>
						) : null}
					</div>
				) : null}

				{editing ? (
					<AlertEditor
						alert={alert}
						rearmed={mode === 'rearmed'}
						cardRef={cardRef}
						onEdited={() => markEdited(alert.id, true)}
						onClose={closeEditor}
					/>
				) : null}
			</div>
		</AlertCard>
	)
})

interface AlertEditorProps {
	alert: Alert
	rearmed: boolean
	cardRef: RefObject<HTMLDivElement | null>
	/** Any change inside the editor counts as work that closing the Alerts dialog would drop. */
	onEdited: () => void
	onClose: () => void
}

// Mounted only while its row edits, so each opening starts from the saved alert.
function AlertEditor({ alert, rearmed, cardRef, onEdited, onClose }: AlertEditorProps) {
	const { authorizedFetch, user } = useAuthContext()
	const queryClient = useQueryClient()
	const parsedSchedule = parseScheduleExpression(alert.schedule_expression)
	const titleRef = useRef<HTMLInputElement>(null)
	// The schedule form's submit state; the price editor keeps its own.
	const [submitted, setSubmitted] = useState(false)
	const [frequency, setFrequency] = useState<'daily' | 'weekly'>(
		alert.schedule_expression.includes('Weekly') ? 'weekly' : 'daily'
	)
	const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>(alert.delivery_channel ?? 'email')
	const [slackTeamId, setSlackTeamId] = useState<string>(alert.slack_team_id ?? '')
	const [slackChannelId, setSlackChannelId] = useState<string>(alert.slack_channel_id ?? '')
	const telegramLinked = useIntegrationLink().state.status === 'linked'
	const slackWorkspacesQuery = useSlackWorkspaces()
	const slackChannelsQuery = useSlackChannels(deliveryChannel === 'slack' && slackTeamId ? slackTeamId : null)
	const slackWorkspaces = (slackWorkspacesQuery.data?.workspaces ?? []).filter((w) => !w.revoked)
	const slackChannels = slackChannelsQuery.data?.channels
	const selectableSlackChannels = (slackChannels ?? []).filter((c) => !c.is_archived)
	selectableSlackChannels.sort((a, b) => Number(a.is_private) - Number(b.is_private) || a.name.localeCompare(b.name))
	const savedTimezone = parsedSchedule.timezone ?? getUserTimezone()
	const timezoneOptions = GMT_OFFSETS.some((option) => option.value === savedTimezone)
		? GMT_OFFSETS
		: [...GMT_OFFSETS, { value: savedTimezone, label: getTimezoneLabel(savedTimezone) }]

	const getConditionUpdate = (nextCondition: string) => {
		const trimmedCondition = nextCondition.trim()
		if (trimmedCondition) return { shouldInclude: true, value: trimmedCondition }
		if (alert.condition !== undefined) return { shouldInclude: true, value: null }
		return { shouldInclude: false, value: null }
	}

	// The editor's last failed save, not the mutation's error: that one clears as soon as a retry starts.
	const [saveFailed, setSaveFailed] = useState(false)
	const updateAlertMutation = useMutation<void, Error, UpdateAlertInput>({
		mutationFn: (input) => updateAlert(authorizedFetch, input, getConditionUpdate(input.condition)),
		onSuccess: (_data, input) => {
			const conditionUpdate = getConditionUpdate(input.condition)
			queryClient.setQueryData([ALERTS_QUERY_KEY, user?.id ?? null], (old: Array<Alert> | undefined) => {
				if (!old) return []
				return applyAlertUpdateToList(old, input, conditionUpdate)
			})
			onClose()
		},
		onError: () => {
			setSaveFailed(true)
			if (!cardRef.current?.isConnected) toast.error(`Couldn't save your changes to “${alert.title}”. Try again.`)
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: [ALERTS_QUERY_KEY] })
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})

	const updateErrorMessage = saveFailed ? "Couldn't save the alert. Try again." : null
	const deliveryError = getDeliveryError({
		channel: deliveryChannel,
		telegramLinked,
		slackTeamId,
		slackChannelId,
		slackWorkspaceCount: slackWorkspaces.length
	})
	const slackGate = getSlackListGate({
		channel: deliveryChannel,
		slackTeamId,
		slackChannelId,
		workspacesLoading: slackWorkspacesQuery.isLoading,
		channelsLoading: slackChannelsQuery.isLoading,
		channelsFailed: queryReadFailed(slackChannelsQuery)
	})
	const slackFields = {
		slack_team_id: deliveryChannel === 'slack' ? slackTeamId : null,
		slack_channel_id: deliveryChannel === 'slack' ? slackChannelId : null,
		slack_channel_name:
			deliveryChannel === 'slack' ? (slackChannels?.find((c) => c.id === slackChannelId)?.name ?? null) : null
	}
	// An emptied name falls back to the one a new alert of the same kind gets, so the list never shows a blank title.
	const defaultTitle =
		alert.trigger?.type === 'price'
			? priceAlertTitle(alert.trigger)
			: deriveAlertTitle({
					triggerType: 'schedule',
					prompt: alert.original_query,
					symbol: null,
					op: 'above',
					value: ''
				})
	const nameField = (
		<Field label="Name (optional)">
			{(control) => (
				<Input
					{...control}
					ref={titleRef}
					name="title"
					defaultValue={alert.title}
					placeholder={defaultTitle}
					className="w-full"
				/>
			)}
		</Field>
	)

	const deliveryFields = (showErrors: boolean) => (
		<FieldGroup label="Deliver to" error={showErrors ? deliveryError : null}>
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedToggle<DeliveryChannel>
					label="Delivery channel"
					value={deliveryChannel}
					onChange={(channel) => {
						setDeliveryChannel(channel)
						onEdited()
					}}
					options={DELIVERY_OPTIONS}
				/>
				{deliveryChannel === 'telegram' && !telegramLinked && (
					<span className="body-sm text-warning">
						Telegram isn't linked yet. Link it in <SettingsIntegrationsLink />
					</span>
				)}
				{deliveryChannel === 'slack' && (
					<>
						{slackWorkspacesQuery.isLoading ? (
							<span className="body-sm text-tertiary">Loading workspaces…</span>
						) : slackWorkspaces.length === 0 ? (
							<span className="body-sm text-warning">
								No Slack workspaces connected. Connect one from <SettingsIntegrationsLink />
							</span>
						) : (
							<select
								value={slackTeamId}
								onChange={(e) => {
									setSlackTeamId(e.target.value)
									const ws = slackWorkspaces.find((w) => w.team_id === e.target.value)
									setSlackChannelId(ws?.default_channel_id ?? '')
								}}
								aria-label="Slack workspace"
								// The group's error names the Slack pick it needs; that pick takes the submit's focus.
								aria-invalid={showErrors && deliveryError && !slackTeamId ? true : undefined}
								className={inputStyles}
							>
								<option value="" disabled>
									Pick workspace
								</option>
								{slackWorkspaces.map((w) => (
									<option key={w.team_id} value={w.team_id}>
										{w.team_name}
									</option>
								))}
							</select>
						)}
						{slackTeamId && (
							<>
								{queryReadFailed(slackChannelsQuery) ? (
									<RetryNotice
										message="Couldn't load Slack channels."
										retrying={slackChannelsQuery.isFetching}
										onRetry={() => void slackChannelsQuery.refetch()}
									/>
								) : slackChannelsQuery.isLoading ? (
									<span className="body-sm text-tertiary">Loading channels…</span>
								) : (
									<select
										// A retried channel list takes the focus its Try again drops as it leaves.
										ref={takeLostFocus}
										value={slackChannelId}
										onChange={(e) => setSlackChannelId(e.target.value)}
										aria-label="Slack channel"
										aria-invalid={showErrors && deliveryError && !slackChannelId ? true : undefined}
										className={inputStyles}
									>
										<option value="" disabled>
											Pick channel
										</option>
										{selectableSlackChannels.map((c) => (
											<option key={c.id} value={c.id} disabled={c.is_private && !c.is_member}>
												{c.is_private ? '🔒 ' : '# '}
												{c.name}
												{c.is_private && !c.is_member ? ' (invite bot first)' : ''}
											</option>
										))}
									</select>
								)}
							</>
						)}
					</>
				)}
			</div>
		</FieldGroup>
	)

	if (alert.trigger?.type === 'price') {
		return (
			<div onInput={onEdited} className="mt-3 flex flex-col gap-3 border-t border-subtle pt-3">
				{rearmed ? (
					<InlineStatus variant="warning">
						Re-armed — if the price is still past your level, it fires again within seconds. Adjust the level below to
						wait for the next cross.
					</InlineStatus>
				) : null}
				<PriceAlertEditor
					trigger={alert.trigger}
					isSaving={updateAlertMutation.isPending}
					fieldsInvalid={deliveryError !== null}
					errorMessage={updateErrorMessage}
					onCancel={onClose}
					onSave={(trigger) => {
						trackUmamiEvent('llamaai-alert-edit')
						updateAlertMutation.mutate({
							alertId: alert.id,
							title: titleRef.current!.value.trim() || priceAlertTitle(trigger),
							delivery_channel: deliveryChannel,
							condition: alert.condition || '',
							trigger,
							...slackFields
						})
					}}
				>
					{(priceSubmitted) => (
						<>
							{nameField}
							{deliveryFields(priceSubmitted)}
						</>
					)}
				</PriceAlertEditor>
			</div>
		)
	}

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault()
				if (updateAlertMutation.isPending || slackGate) return
				if (deliveryError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
				const fd = new FormData(e.currentTarget)
				trackUmamiEvent('llamaai-alert-edit')
				updateAlertMutation.mutate({
					alertId: alert.id,
					title: (fd.get('title') as string).trim() || defaultTitle,
					alertConfig: {
						frequency: fd.get('frequency') as 'daily' | 'weekly',
						hour: Number(fd.get('hour')),
						dayOfWeek: Number(fd.get('dayOfWeek')),
						timezone: fd.get('timezone') as string
					},
					delivery_channel: deliveryChannel,
					condition: fd.get('condition') as string,
					...slackFields
				})
			}}
			onInput={onEdited}
			className="mt-3 flex flex-col gap-3 border-t border-subtle pt-3"
		>
			{nameField}
			<div className="flex flex-col gap-1.5">
				<span className={alertFieldLabelClass}>Schedule</span>
				<div className="flex flex-wrap items-center gap-2">
					<select
						name="frequency"
						value={frequency}
						onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
						aria-label="Frequency"
						className={inputStyles}
					>
						<option value="daily">Daily</option>
						<option value="weekly">Weekly</option>
					</select>
					{frequency === 'weekly' ? (
						<select
							name="dayOfWeek"
							defaultValue={parsedSchedule.dayOfWeek ?? 1}
							aria-label="Day of week"
							className={inputStyles}
						>
							{DAYS_OF_WEEK.map((day, idx) => (
								<option key={day} value={idx}>
									{day}
								</option>
							))}
						</select>
					) : (
						<input type="hidden" name="dayOfWeek" value={1} />
					)}
					<span className="body-sm text-secondary">at</span>
					<select name="hour" defaultValue={parsedSchedule.hour ?? 9} aria-label="Hour" className={inputStyles}>
						{Array.from({ length: 24 }, (_, h) => (
							<option key={h} value={h}>
								{h.toString().padStart(2, '0')}:00
							</option>
						))}
					</select>
					<select name="timezone" defaultValue={savedTimezone} aria-label="Timezone" className={inputStyles}>
						{timezoneOptions.map((tz) => (
							<option key={tz.value} value={tz.value}>
								{tz.label}
							</option>
						))}
					</select>
				</div>
			</div>
			{deliveryFields(submitted)}
			<Field label="Condition (optional)">
				{(control) => (
					<Input
						{...control}
						name="condition"
						defaultValue={alert.condition || ''}
						placeholder="Only send if TVL drops below $1B"
						className="w-full"
					/>
				)}
			</Field>
			{updateErrorMessage ? <InlineStatus variant="error">{updateErrorMessage}</InlineStatus> : null}
			<div className="flex flex-wrap items-center justify-end gap-2">
				<Button type="button" size="md" disabled={updateAlertMutation.isPending} onClick={onClose}>
					Cancel
				</Button>
				{/* A failed channel list holds Save; its notice and Try again sit in the delivery field. */}
				<Button
					type="submit"
					variant="primary"
					size="md"
					disabled={slackGate === 'channelsFailed'}
					accessibleWhenDisabled
					pendingLabel={updateAlertMutation.isPending ? 'Saving…' : slackGate === 'channelsFailed' ? null : slackGate}
				>
					Save
				</Button>
			</div>
		</form>
	)
}
