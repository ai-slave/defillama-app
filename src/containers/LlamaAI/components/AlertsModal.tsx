import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { memo, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import {
	applyAlertUpdateToList,
	execChipLabel,
	execChipTone,
	formatPriceAlertSummary,
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
import { getUpsellCopy, type TriggerType } from '~/containers/LlamaAI/components/alerts/createAlertForm'
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
	UpdateAlertInput
} from '~/containers/LlamaAI/components/alerts/types'
import {
	alertDialogClass,
	alertFieldLabelClass,
	alertIconButtonClass,
	alertInputClass,
	alertPrimaryButtonClass,
	alertSelectClass,
	AlertsDialogHeader,
	SegmentedToggle,
	DELIVERY_OPTIONS,
	StatusChip,
	SettingsIntegrationsLink,
	ToggleSwitch
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
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatFixedNumber } from '~/utils/numberFormat'
import { RetryNotice } from './RetryNotice'

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
	const [hasOpenedCreate, setHasOpenedCreate] = useState(false)
	const upsellActive = isAlertsUpsellActive(alertsUsage)
	const accessState = getAlertsAccessState(isAuthenticated, loaders.userLoading)

	const openCreateModal = (tab: TriggerType) => {
		setCreateTab(tab)
		setHasOpenedCreate(true)
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

	const {
		data: alerts,
		isLoading,
		error: alertsError,
		isFetching: isFetchingAlerts,
		refetch: refetchAlerts
	} = useQuery<Array<Alert>>({
		queryKey: alertsQueryKey,
		queryFn: async () => {
			if (!authorizedFetch) return []
			return fetchAlerts(authorizedFetch)
		},
		enabled: isOpen && isAuthenticated && !!user
	})

	return (
		<>
			<Ariakit.DialogProvider store={dialogStore}>
				<Ariakit.Dialog
					className={alertDialogClass}

					portal
					unmountOnHide
				>
					<AlertsDialogHeader
						title="Alerts"
						subtitle={getAlertsSubtitle(alertsUsage, alerts?.length)}
						right={
							accessState === 'ready' && !upsellActive && alerts && alerts.length > 0 ? (
								<Button type="button" size="md" variant="outline" onClick={() => openCreateModal('schedule')}>
									<Icon name="plus" className="size-3.5" />
									New alert
								</Button>
							) : null
						}
					/>

					<div className="min-h-0 flex-1 overflow-y-auto">
						{accessState === 'loading' ? (
							<div role="status" aria-label="Loading alerts" className="flex items-center justify-center py-16">
								<LoadingSpinner size={24} />
							</div>
						) : accessState === 'sign-in' ? (
							<div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
								<div className="flex size-14 items-center justify-center rounded-lg bg-warning/10 text-warning">
									<Icon name="calendar-plus" className="size-6 text-warning" />
								</div>
								<div>
									<p className="m-0 text-sm font-semibold text-primary">Sign in to use alerts</p>
									<p className="m-0 mt-1 body-sm text-secondary">
										Create alerts and manage their delivery from one place.
									</p>
								</div>
								<button type="button" onClick={signInModalStore.show} className={alertPrimaryButtonClass}>
									Sign in
								</button>
							</div>
						) : alertsError ? (
							<div className="px-5 py-3">
								<RetryNotice
									message="Couldn't load alerts."
									retrying={isFetchingAlerts}
									onRetry={() => void refetchAlerts()}
								/>
							</div>
						) : null}
						{accessState !== 'ready' ? null : isLoading ? (
							<div role="status" aria-label="Loading alerts" className="flex items-center justify-center py-16">
								<LoadingSpinner size={24} />
							</div>
						) : !alerts || alerts.length === 0 ? (
							alertsError ? null : upsellActive ? (
								<div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
									<div className="flex size-14 items-center justify-center rounded-lg bg-warning/10 text-warning">
										<Icon name="alert-triangle" className="size-6 text-warning" />
									</div>
									<p className="text-sm text-tertiary">{getUpsellCopy(alertsUsage ?? null)}</p>
									<BasicLink href="/subscription" className={alertPrimaryButtonClass}>
										Upgrade to Pro
									</BasicLink>
								</div>
							) : (
								<EmptyAlertsState onOpenCreate={openCreateModal} onChipSelect={handleChipSelect} />
							)
						) : (
							<div className="flex flex-col gap-2 p-3">
								{upsellActive ? (
									<div className="bg-warning/0.06 flex items-center justify-between gap-3 rounded-xl border border-warning/20 px-4 py-3">
										<p className="m-0 text-xs text-warning">{getUpsellCopy(alertsUsage ?? null)}</p>
										<BasicLink
											href="/subscription"
											className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-ai-white hover:brightness-110"
										>
											Upgrade
										</BasicLink>
									</div>
								) : null}
								{alerts.map((alert) => (
									<AlertRow key={alert.id} alert={alert} />
								))}
							</div>
						)}
					</div>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
			<SignInModal store={signInModalStore} prompt="Sign in to create alerts and manage their delivery" />
			{hasOpenedCreate ? (
				<CreateAlertModal dialogStore={createModalStore} initialTab={createTab} onJustAsk={handleJustAsk} />
			) : null}
		</>
	)
})

interface AlertRowProps {
	alert: Alert
}

function AlertCard({ children }: { children: React.ReactNode }) {
	return <div className="rounded-lg border border-subtle bg-surface px-4 py-3.5">{children}</div>
}

const formatExecDate = (iso: string) => {
	const d = new Date(iso)
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${formatFixedNumber(ms / 1000, 1)}s`)

const AlertRow = memo(function AlertRow({ alert }: AlertRowProps) {
	const { authorizedFetch, user } = useAuthContext()
	const queryClient = useQueryClient()
	const isPriceAlert = alert.trigger?.type === 'price'
	const parsedSchedule = parseScheduleExpression(alert.schedule_expression)
	const initialTimezone = parsedSchedule.timezone ?? getUserTimezone()
	const conditionId = `alert-condition-${alert.id}`
	const [frequency, setFrequency] = useState<'daily' | 'weekly'>(
		alert.schedule_expression.includes('Weekly') ? 'weekly' : 'daily'
	)
	const [timezone, setTimezone] = useState(() => initialTimezone)
	const [hourDefault, setHourDefault] = useState(() => parsedSchedule.hour ?? 9)
	const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>(alert.delivery_channel ?? 'email')
	const [slackTeamId, setSlackTeamId] = useState<string>(alert.slack_team_id ?? '')
	const [slackChannelId, setSlackChannelId] = useState<string>(alert.slack_channel_id ?? '')
	const priceEditTitleRef = useRef<HTMLInputElement>(null)
	const [mode, setMode] = useState<'view' | 'editing' | 'deleting'>('view')
	const [showRearmNote, setShowRearmNote] = useState(false)
	const [showExecutions, setShowExecutions] = useState(false)
	const [selectedExecId, setSelectedExecId] = useState<string | null>(null)
	const telegramLink = useIntegrationLink()
	const telegramLinked = telegramLink.state.status === 'linked'
	const slackWorkspacesQuery = useSlackWorkspaces()
	const slackChannelsQuery = useSlackChannels(deliveryChannel === 'slack' && slackTeamId ? slackTeamId : null)
	const slackWorkspaces = useMemo(() => {
		const workspaces = slackWorkspacesQuery.data?.workspaces ?? []
		return workspaces.filter((w) => !w.revoked)
	}, [slackWorkspacesQuery.data?.workspaces])
	const slackChannels = slackChannelsQuery.data?.channels
	const selectableSlackChannels = useMemo(() => {
		const channels = (slackChannels ?? []).filter((c) => !c.is_archived)
		channels.sort((a, b) => Number(a.is_private) - Number(b.is_private) || a.name.localeCompare(b.name))
		return channels
	}, [slackChannels])
	const deliveryReady =
		deliveryChannel === 'email' ||
		(deliveryChannel === 'telegram' && telegramLinked) ||
		(deliveryChannel === 'slack' && !!slackTeamId && !!slackChannelId)
	const timezoneOptions = useMemo(() => {
		if (GMT_OFFSETS.some((option) => option.value === timezone)) return GMT_OFFSETS
		return [...GMT_OFFSETS, { value: timezone, label: getTimezoneLabel(timezone) }]
	}, [timezone])
	const alertsQueryKey = [ALERTS_QUERY_KEY, user?.id ?? null]

	const executionsQuery = useQuery<Array<AlertExecution>>({
		queryKey: [ALERTS_QUERY_KEY, alert.id, 'executions'],
		queryFn: async () => {
			if (!authorizedFetch) throw new Error('Not authenticated')
			return fetchAlertExecutions(authorizedFetch, alert.id)
		},
		enabled: showExecutions && !!authorizedFetch
	})

	const execDetailQuery = useQuery<AlertExecutionDetail>({
		queryKey: [ALERTS_QUERY_KEY, alert.id, 'executions', selectedExecId],
		queryFn: async () => {
			if (!authorizedFetch) throw new Error('Not authenticated')
			if (!selectedExecId) throw new Error('Missing execution id')
			return fetchAlertExecutionDetail(authorizedFetch, alert.id, selectedExecId)
		},
		enabled: !!selectedExecId && !!authorizedFetch
	})

	const handleToggleExecutions = () => {
		const next = !showExecutions
		setShowExecutions(next)
		if (!next) setSelectedExecId(null)
	}

	const resetEditingState = () => {
		const nextParsedSchedule = parseScheduleExpression(alert.schedule_expression)
		const nextTimezone = nextParsedSchedule.timezone ?? getUserTimezone()
		setFrequency(alert.schedule_expression.includes('Weekly') ? 'weekly' : 'daily')
		setTimezone(nextTimezone)
		setHourDefault(nextParsedSchedule.hour ?? 9)
		setDeliveryChannel(alert.delivery_channel ?? 'email')
		setSlackTeamId(alert.slack_team_id ?? '')
		setSlackChannelId(alert.slack_channel_id ?? '')
	}

	const getConditionUpdate = (nextCondition: string) => {
		const trimmedCondition = nextCondition.trim()
		if (trimmedCondition) {
			return { shouldInclude: true, value: trimmedCondition }
		}

		if (alert.condition !== undefined) {
			return { shouldInclude: true, value: null }
		}

		return { shouldInclude: false, value: null }
	}

	const toggleAlertMutation = useMutation<
		boolean,
		Error,
		{ alertId: string; enabled: boolean },
		{ previousEnabled: boolean | undefined }
	>({
		mutationKey: alertsQueryKey,
		mutationFn: async ({ alertId, enabled }: { alertId: string; enabled: boolean }) => {
			if (!authorizedFetch) {
				throw new Error('Not authenticated')
			}
			return setAlertEnabled(authorizedFetch, alertId, enabled)
		},
		onMutate: async ({ alertId, enabled }) => {
			await queryClient.cancelQueries({ queryKey: alertsQueryKey })
			const previous = queryClient.getQueryData<Array<Alert>>(alertsQueryKey)
			queryClient.setQueryData(alertsQueryKey, (old: Array<Alert> | undefined) => {
				if (!old) return []
				return old.map((item) => (item.id === alertId ? { ...item, enabled } : item))
			})
			return { previousEnabled: previous?.find((item) => item.id === alertId)?.enabled }
		},
		onError: (_error, { alertId }, context) => {
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

	const deleteAlertMutation = useMutation<string, Error, string, { previous?: Array<Alert> }>({
		mutationFn: async (alertId: string) => {
			if (!authorizedFetch) {
				throw new Error('Not authenticated')
			}
			return deleteAlert(authorizedFetch, alertId)
		},
		onMutate: async (alertId: string) => {
			await queryClient.cancelQueries({ queryKey: alertsQueryKey })
			const previous = queryClient.getQueryData<Array<Alert>>(alertsQueryKey)
			queryClient.setQueryData(alertsQueryKey, (old: Array<Alert> | undefined) => {
				if (!old) return []
				return old.filter((item) => item.id !== alertId)
			})
			return { previous }
		},
		onError: (_error, _alertId, context) => {
			if (context?.previous) {
				queryClient.setQueryData(alertsQueryKey, context.previous)
			}
		},
		onSuccess: () => {
			switchMode('view')
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: [ALERTS_QUERY_KEY] })
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})

	const updateAlertMutation = useMutation<void, Error, UpdateAlertInput>({
		mutationFn: async (input) => {
			if (!authorizedFetch) {
				throw new Error('Not authenticated')
			}
			return updateAlert(authorizedFetch, input, getConditionUpdate(input.condition))
		},
		onSuccess: (_data, input) => {
			const conditionUpdate = getConditionUpdate(input.condition)
			queryClient.setQueryData(alertsQueryKey, (old: Array<Alert> | undefined) => {
				if (!old) return []
				return applyAlertUpdateToList(old, input, conditionUpdate)
			})
			switchMode('view')
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: [ALERTS_QUERY_KEY] })
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})

	const switchMode = (next: 'view' | 'editing' | 'deleting') => {
		if (!toggleAlertMutation.isPending) toggleAlertMutation.reset()
		if (!updateAlertMutation.isPending) updateAlertMutation.reset()
		if (!deleteAlertMutation.isPending) deleteAlertMutation.reset()
		if (next === 'editing') {
			resetEditingState()
		}
		setShowRearmNote(false)
		setMode(next)
	}

	const handleRearm = () => {
		if (toggleAlertMutation.isPending) return
		trackUmamiEvent('llamaai-alert-rearm')
		switchMode('editing')
		setShowRearmNote(true)
		toggleAlertMutation.mutate({ alertId: alert.id, enabled: true })
	}

	const toggleErrorMessage = toggleAlertMutation.error?.message
	const updateErrorMessage = updateAlertMutation.error?.message
	const deleteErrorMessage = deleteAlertMutation.error?.message

	const deliveryFields = (
		<div className="flex flex-col gap-1.5">
			<span className={alertFieldLabelClass}>Deliver to</span>
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedToggle<DeliveryChannel>
					label="Delivery channel"
					value={deliveryChannel}
					onChange={setDeliveryChannel}
					options={DELIVERY_OPTIONS}
				/>
				{deliveryChannel === 'telegram' && !telegramLinked && (
					<span className="text-xs text-warning">
						Telegram isn't linked yet. Link it in <SettingsIntegrationsLink />
					</span>
				)}
				{deliveryChannel === 'slack' && (
					<>
						{slackWorkspacesQuery.isLoading ? (
							<span className="text-xs text-tertiary">Loading workspaces…</span>
						) : slackWorkspaces.length === 0 ? (
							<span className="text-xs text-warning">
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
								className={alertSelectClass}
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
								{slackChannelsQuery.isLoading ? (
									<span className="text-xs text-tertiary">Loading channels…</span>
								) : slackChannelsQuery.isError ? (
									<span className="text-xs text-error">Failed to load channels</span>
								) : (
									<select
										value={slackChannelId}
										onChange={(e) => setSlackChannelId(e.target.value)}
										className={alertSelectClass}
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
		</div>
	)

	if (mode === 'deleting') {
		return (
			<div className="bg-error/0.04 rounded-xl border border-error/20 px-4 py-3.5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className="m-0 min-w-0 text-sm text-primary">
						Delete “{alert.title}”?
						<span className="ml-1.5 text-xs text-tertiary">This can’t be undone.</span>
					</p>
					<div className="flex shrink-0 gap-2">
						<button
							type="button"
							onClick={() => switchMode('view')}
							className="rounded-lg px-3 py-1.5 text-xs text-tertiary not-disabled:not-aria-disabled:hover:bg-hover-row"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => deleteAlertMutation.mutate(alert.id)}
							disabled={deleteAlertMutation.isPending}
							className="flex items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-ai-white not-disabled:not-aria-disabled:hover:bg-ai-error disabled:opacity-50"
						>
							{deleteAlertMutation.isPending ? <LoadingSpinner size={12} /> : null}
							Delete
						</button>
					</div>
				</div>
				{deleteErrorMessage ? <p className="mt-2 text-xs text-error">{deleteErrorMessage}</p> : null}
			</div>
		)
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
	if (selectedExec) {
		const charts = selectedExec.generated_charts || []
		return (
			<AlertCard>
				<button
					type="button"
					onClick={() => setSelectedExecId(null)}
					className="mb-3 flex items-center gap-1 text-xs font-medium text-link not-disabled:not-aria-disabled:hover:underline"
				>
					<Icon name="arrow-left" className="size-3" />
					Back to history
				</button>
				<div className="mb-3 flex items-center justify-between">
					<span className="font-mono text-xs text-tertiary">{formatExecDate(selectedExec.executed_at)}</span>
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
					<p className="text-xs text-error">{selectedExec.error_message}</p>
				) : (
					<p className="text-xs text-tertiary">No content available.</p>
				)}
				{charts.length > 0
					? charts
							.filter((c) => sanitizeUrl(c.url) && !selectedExec.generated_summary?.includes(`[CHART:${c.id}]`))
							.map((c) => (
								<img
									key={c.id}
									src={sanitizeUrl(c.url)!}
									alt={c.title || 'Chart'}
									className="my-2 max-w-full rounded-lg"
								/>
							))
					: null}
				{selectedExec.citations?.length ? (
					<div className="mt-3 border-t border-subtle pt-3">
						<SourcesList citations={selectedExec.citations} />
					</div>
				) : null}
			</AlertCard>
		)
	}

	const typeTileClass = !alert.enabled
		? 'bg-surface-elevated-2 text-tertiary'
		: isPriceAlert
			? 'bg-page text-secondary'
			: 'bg-link/10 text-link'

	return (
		<AlertCard>
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
							onClick={handleRearm}
							className="mr-1 hidden items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-xs font-medium text-warning not-disabled:not-aria-disabled:hover:bg-warning/20 sm:flex"
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
									<button
										type="button"
										onClick={handleToggleExecutions}
										aria-pressed={showExecutions}
										aria-label="View history"
									/>
								}
								className={alertIconButtonClass}
								data-active={showExecutions}
							>
								<Icon name="clock" className="size-4" />
							</Tooltip>
						) : null}
						<Tooltip
							content="Edit"
							render={
								<button
									type="button"
									onClick={() => switchMode(mode === 'editing' ? 'view' : 'editing')}
									aria-pressed={mode === 'editing'}
									aria-label="Edit"
								/>
							}
							className={alertIconButtonClass}
							data-active={mode === 'editing'}
						>
							<Icon name="pencil" className="size-4" />
						</Tooltip>
						<Tooltip
							content="Delete"
							render={<button type="button" onClick={() => switchMode('deleting')} aria-label="Delete" />}
							className={alertIconButtonClass}
						>
							<Icon name="trash-2" className="size-4 text-error" />
						</Tooltip>
					</div>
					<Ariakit.MenuProvider placement="bottom-end">
						<Ariakit.MenuButton
							aria-label={`Actions for alert ${alert.title}`}
							render={<Button type="button" size="md" variant="ghost" square className="sm:hidden" />}
							data-active={showExecutions || mode === 'editing'}
						>
							<Icon name="ellipsis" height={16} width={16} />
						</Ariakit.MenuButton>
						<MenuSurface variant="actions" gutter={6} className="z-50">
							{isFiredOneTimePriceAlert(alert) ? (
								<MenuItem onClick={handleRearm}>
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
							<MenuItem onClick={() => switchMode(mode === 'editing' ? 'view' : 'editing')}>
								<Icon name="pencil" height={14} width={14} />
								{mode === 'editing' ? 'Cancel editing' : 'Edit alert'}
							</MenuItem>
							<MenuItem className="text-error" onClick={() => switchMode('deleting')}>
								<Icon name="trash-2" height={14} width={14} />
								Delete alert
							</MenuItem>
						</MenuSurface>
					</Ariakit.MenuProvider>
					<div className="ml-1.5">
						<ToggleSwitch
							checked={alert.enabled}
							label="Alert enabled"
							isLoading={toggleAlertMutation.isPending}
							onClick={() => {
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

			{toggleErrorMessage ? (
				<p role="alert" className="mt-2 text-xs text-error">
					{toggleErrorMessage}
				</p>
			) : null}

			{showExecutions ? (
				<div className="mt-3 border-t border-subtle pt-3">
					<p className="mb-2 label-xs tracking-wide text-tertiary uppercase">History</p>
					{executionsQuery.isLoading ? (
						<div role="status" aria-label="Loading alert history" className="flex justify-center py-4">
							<LoadingSpinner size={16} />
						</div>
					) : executionsQuery.isError ? (
						<RetryNotice
							message="Couldn't load alert history."
							retrying={executionsQuery.isFetching}
							onRetry={() => void executionsQuery.refetch()}
						/>
					) : !executionsQuery.data || executionsQuery.data.length === 0 ? (
						<p className="text-center text-xs text-tertiary">No executions yet.</p>
					) : (
						<div className="flex flex-col">
							{executionsQuery.data.map((exec) => (
								<button
									type="button"
									key={exec.id}
									onClick={() => setSelectedExecId(exec.id)}
									disabled={execDetailQuery.isLoading}
									className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left not-disabled:not-aria-disabled:hover:bg-hover-row"
								>
									<div className="flex items-baseline gap-2">
										<span className="font-mono text-xs text-primary">{formatExecDate(exec.executed_at)}</span>
										<span className="label-xs text-tertiary">{formatDuration(exec.duration_ms)}</span>
									</div>
									<StatusChip tone={execChipTone(exec.status, !!exec.error_message)}>
										{execChipLabel(exec.status)}
									</StatusChip>
								</button>
							))}
						</div>
					)}
					{execDetailQuery.isLoading ? (
						<div role="status" aria-label="Loading alert execution" className="mt-2 flex justify-center">
							<LoadingSpinner size={16} />
						</div>
					) : execDetailQuery.isError ? (
						<RetryNotice
							message="Couldn't load this execution."
							retrying={execDetailQuery.isFetching}
							onRetry={() => void execDetailQuery.refetch()}
						/>
					) : null}
				</div>
			) : null}

			{mode === 'editing' && isPriceAlert && alert.trigger ? (
				<div className="mt-3 flex flex-col gap-3 border-t border-subtle pt-3">
					{showRearmNote ? (
						<p className="m-0 text-xs text-warning">
							Re-armed — if the price is still past your level, it fires again within seconds. Adjust the level below to
							wait for the next cross.
						</p>
					) : null}
					<input
						ref={priceEditTitleRef}
						defaultValue={alert.title}
						required
						placeholder="Alert title"
						className={alertInputClass}
					/>
					{deliveryFields}
					<PriceAlertEditor
						trigger={alert.trigger}
						isSaving={updateAlertMutation.isPending}
						canSave={deliveryReady}
						errorMessage={updateAlertMutation.error?.message}
						onCancel={() => switchMode('view')}
						onSave={(trigger) => {
							const titleValue = priceEditTitleRef.current?.value.trim() ?? ''
							if (!titleValue) return
							if (deliveryChannel === 'telegram' && !telegramLinked) return
							if (deliveryChannel === 'slack' && (!slackTeamId || !slackChannelId)) return
							trackUmamiEvent('llamaai-alert-edit')
							const channelName =
								deliveryChannel === 'slack' ? (slackChannels?.find((c) => c.id === slackChannelId)?.name ?? null) : null
							updateAlertMutation.mutate({
								alertId: alert.id,
								title: titleValue,
								delivery_channel: deliveryChannel,
								condition: alert.condition || '',
								trigger,
								slack_team_id: deliveryChannel === 'slack' ? slackTeamId : null,
								slack_channel_id: deliveryChannel === 'slack' ? slackChannelId : null,
								slack_channel_name: channelName
							})
						}}
					/>
				</div>
			) : mode === 'editing' ? (
				<form
					onSubmit={(e) => {
						e.preventDefault()
						const fd = new FormData(e.currentTarget)
						const titleValue = (fd.get('title') as string).trim()
						if (!titleValue) return
						if (deliveryChannel === 'telegram' && !telegramLinked) return
						if (deliveryChannel === 'slack' && (!slackTeamId || !slackChannelId)) return
						trackUmamiEvent('llamaai-alert-edit')
						const channelName =
							deliveryChannel === 'slack' ? (slackChannels?.find((c) => c.id === slackChannelId)?.name ?? null) : null
						updateAlertMutation.mutate({
							alertId: alert.id,
							title: titleValue,
							alertConfig: {
								frequency: fd.get('frequency') as 'daily' | 'weekly',
								hour: Number(fd.get('hour')),
								dayOfWeek: Number(fd.get('dayOfWeek')),
								timezone: fd.get('timezone') as string
							},
							delivery_channel: deliveryChannel,
							condition: fd.get('condition') as string,
							slack_team_id: deliveryChannel === 'slack' ? slackTeamId : null,
							slack_channel_id: deliveryChannel === 'slack' ? slackChannelId : null,
							slack_channel_name: channelName
						})
					}}
					className="mt-3 flex flex-col gap-3 border-t border-subtle pt-3"
				>
					<input
						name="title"
						defaultValue={alert.title}
						required
						placeholder="Alert title"
						className={alertInputClass}
					/>
					<div className="flex flex-col gap-1.5">
						<span className={alertFieldLabelClass}>Schedule</span>
						<div className="flex flex-wrap items-center gap-2">
							<select
								name="frequency"
								defaultValue={frequency}
								onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
								className={alertSelectClass}
							>
								<option value="daily">Daily</option>
								<option value="weekly">Weekly</option>
							</select>
							{frequency === 'weekly' ? (
								<select name="dayOfWeek" defaultValue={parsedSchedule.dayOfWeek ?? 1} className={alertSelectClass}>
									{DAYS_OF_WEEK.map((day, idx) => (
										<option key={day} value={idx}>
											{day}
										</option>
									))}
								</select>
							) : (
								<input type="hidden" name="dayOfWeek" value={1} />
							)}
							<span className="text-xs text-tertiary">at</span>
							<select
								key={`hour-${timezone}`}
								name="hour"
								defaultValue={hourDefault}
								onChange={(e) => setHourDefault(Number(e.target.value))}
								className={alertSelectClass}
							>
								{Array.from({ length: 24 }, (_, h) => (
									<option key={h} value={h}>
										{h.toString().padStart(2, '0')}:00
									</option>
								))}
							</select>
							<select
								name="timezone"
								defaultValue={timezone}
								onChange={(e) => setTimezone(e.target.value)}
								className={alertSelectClass}
							>
								{timezoneOptions.map((tz) => (
									<option key={tz.value} value={tz.value}>
										{tz.label}
									</option>
								))}
							</select>
						</div>
					</div>
					{deliveryFields}
					<div className="flex flex-col gap-1.5">
						<label htmlFor={conditionId} className={alertFieldLabelClass}>
							Condition (optional)
						</label>
						<input
							id={conditionId}
							name="condition"
							defaultValue={alert.condition || ''}
							placeholder="e.g. only send if TVL drops below $1B"
							className={alertInputClass}
						/>
					</div>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => switchMode('view')}
							className="rounded-lg px-3 py-1.5 text-xs text-tertiary not-disabled:not-aria-disabled:hover:bg-hover-row"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={updateAlertMutation.isPending || !deliveryReady}
							className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-ai-white not-disabled:not-aria-disabled:hover:brightness-110 disabled:opacity-50"
						>
							{updateAlertMutation.isPending ? (
								<LoadingSpinner size={12} />
							) : (
								<Icon name="check" className="size-3.5" />
							)}
							Save
						</button>
					</div>
					{updateErrorMessage ? <p className="text-center text-xs text-error">{updateErrorMessage}</p> : null}
				</form>
			) : null}
		</AlertCard>
	)
})
