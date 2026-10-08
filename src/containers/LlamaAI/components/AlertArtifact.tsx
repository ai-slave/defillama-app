import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { AI_SERVER } from '~/constants'
import { formatPriceAlertSummary, formatTokenLabel } from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import {
	buildArtifactSaveBody,
	buildScheduleExpressionRaw,
	formatNextRunAt,
	getArtifactSubtitle,
	getDeliveryBlockReason,
	getDeliveryReadinessBlock,
	getUpsellCopy,
	isAlertCapReachedError,
	resolveSlackChannelName,
	resolveSlackTarget,
	roundPriceValue,
	validatePriceTrigger,
	type ArtifactSaveBody,
	type SlackTarget
} from '~/containers/LlamaAI/components/alerts/createAlertForm'
import {
	DAYS_OF_WEEK,
	formatScheduleExpression,
	getTimezoneLabel,
	GMT_OFFSETS
} from '~/containers/LlamaAI/components/alerts/schedule'
import type { DeliveryChannel, PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import {
	alertFieldLabelClass,
	alertInputClass,
	PriceInput,
	SegmentedToggle,
	PRICE_OPERATOR_OPTIONS,
	DELIVERY_OPTIONS,
	SettingsIntegrationsLink
} from '~/containers/LlamaAI/components/alerts/ui'
import { RetryNotice } from '~/containers/LlamaAI/components/RetryNotice'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { useSlackChannels } from '~/containers/LlamaAI/hooks/useSlackChannels'
import { useSlackWorkspaces } from '~/containers/LlamaAI/hooks/useSlackIntegrationLink'
import type { AlertIntent } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { Skeleton } from '~/ui/Skeleton'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { queryReadFailed } from '~/utils/query'

export function AlertArtifactLoading() {
	return (
		<div
			role="status"
			aria-label="Loading alert"
			className="my-2 flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-3"
		>
			<div className="flex items-center gap-3">
				<Skeleton className="size-10 shrink-0 rounded-lg" />
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-3 w-44" />
				</div>
			</div>
			<Skeleton className="h-8 w-full rounded-lg" />
			<div className="flex flex-wrap items-center gap-2">
				<Skeleton className="h-8 w-20 rounded-lg" />
				<Skeleton className="h-8 w-16 rounded-lg" />
				<Skeleton className="ml-auto h-8 w-28 rounded-lg" />
			</div>
		</div>
	)
}

interface AlertArtifactProps {
	alertId: string
	alertIntent: AlertIntent
	messageId?: string
	savedAlertIds?: Array<string>
	defaultTitle?: string
	prompt?: string
}

type TestSentState = 'sent' | 'already' | null

export function AlertArtifact({
	alertId,
	alertIntent,
	messageId,
	savedAlertIds,
	defaultTitle,
	prompt
}: AlertArtifactProps) {
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const { openAlertsModal } = useTipActions()
	const [title, setTitle] = useState(defaultTitle || 'Untitled alert')
	const trigger = alertIntent.trigger ?? null
	const isPriceAlert = !!trigger
	const [frequency, setFrequency] = useState<'daily' | 'weekly'>(alertIntent.frequency ?? 'daily')
	const [hour, setHour] = useState(alertIntent.hour ?? 9)
	const [dayOfWeek, setDayOfWeek] = useState(alertIntent.dayOfWeek ?? 1)
	const [timezone, setTimezone] = useState(alertIntent.timezone ?? 'UTC')
	const [priceOp, setPriceOp] = useState<'above' | 'below'>(trigger?.op ?? 'above')
	const [priceValue, setPriceValue] = useState(trigger ? roundPriceValue(trigger.value) : '')
	const [hasRetriedTest, setHasRetriedTest] = useState(false)
	const [promptExpanded, setPromptExpanded] = useState(false)

	const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>(alertIntent.deliveryChannel || 'email')
	const isSlack = deliveryChannel === 'slack'
	const [pickedSlack, setPickedSlack] = useState<SlackTarget | null>(
		alertIntent.slackTeamId ? { teamId: alertIntent.slackTeamId, channelId: alertIntent.slackChannelId ?? '' } : null
	)
	const telegramLink = useIntegrationLink()
	const telegramLinked = telegramLink.state.status === 'linked'
	const slackWorkspacesQuery = useSlackWorkspaces()
	const activeWorkspaces = useMemo(() => {
		const workspaces = slackWorkspacesQuery.data?.workspaces ?? []
		return workspaces.filter((w) => !w.revoked)
	}, [slackWorkspacesQuery.data?.workspaces])
	const { teamId: slackTeamId, channelId: slackChannelId } = resolveSlackTarget({
		isSlack,
		picked: pickedSlack,
		workspaces: activeWorkspaces
	})
	const slackChannelsQuery = useSlackChannels(isSlack && slackTeamId ? slackTeamId : null)
	const slackChannels = slackChannelsQuery.data?.channels
	const selectableSlackChannels = useMemo(() => {
		const channels = (slackChannels ?? []).filter((c) => !c.is_archived)
		channels.sort((a, b) => Number(a.is_private) - Number(b.is_private) || a.name.localeCompare(b.name))
		return channels
	}, [slackChannels])
	const timezoneOptions = useMemo(() => {
		if (GMT_OFFSETS.some((option) => option.value === timezone)) return GMT_OFFSETS
		return [...GMT_OFFSETS, { value: timezone, label: getTimezoneLabel(timezone) }]
	}, [timezone])
	const slackChannelName = resolveSlackChannelName({
		channelId: slackChannelId,
		channels: slackChannels,
		intentChannelId: alertIntent.slackChannelId,
		intentChannelName: alertIntent.slackChannelName
	})
	const priceValidationError = trigger ? validatePriceTrigger({ tokenNk: trigger.token_nk, value: priceValue }) : null
	const editedTrigger: PriceTrigger | null = trigger ? { ...trigger, op: priceOp, value: Number(priceValue) } : null

	const {
		mutate: saveAlert,
		data: savedAlert,
		isPending: isSaving,
		error: saveError
	} = useMutation<{ id: string; nextRunAt?: string; next_run_at?: string }, Error, ArtifactSaveBody>({
		mutationFn: async (payload) => {
			const res = await authorizedFetch(`${AI_SERVER}/alerts`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
			if (!res) throw new Error('Not authenticated')
			if (!res.ok) {
				const errBody = await res.json().catch(() => ({}))
				throw new Error(errBody?.error || 'Failed to save alert')
			}
			return res.json()
		},
		onSuccess: () => {
			trackUmamiEvent('llamaai-alert-created', { type: isPriceAlert ? 'price' : 'schedule', source: 'artifact' })
		}
	})
	const savedDbId = savedAlert?.id ?? (savedAlertIds?.includes(alertId) ? alertId : null)
	const savedNextRunAt = savedAlert?.nextRunAt || savedAlert?.next_run_at || null
	const isSaved = savedDbId !== null

	const alertDetailQuery = useQuery<{ alert?: { test_sent?: boolean } }>({
		queryKey: ['llamaai-alert-detail', savedDbId],
		queryFn: async () => {
			const res = await authorizedFetch(`${AI_SERVER}/alerts/${savedDbId}`)
			if (!res?.ok) throw new Error('Failed to load alert')
			return res.json()
		},
		enabled: !!savedDbId,
		staleTime: 30_000
	})

	const testMutation = useMutation<{ alreadySent: boolean }, Error, string>({
		mutationFn: async (dbId: string) => {
			const res = await authorizedFetch(`${AI_SERVER}/alerts/${dbId}/test`, { method: 'POST' })
			if (!res) throw new Error('Not authenticated')
			if (res.status === 429) return { alreadySent: true }
			if (!res.ok) throw new Error(`Test failed: ${res.status}`)
			const data: { success: boolean; error?: string } = await res.json()
			if (!data.success) throw new Error(data.error ?? 'Test failed')
			return { alreadySent: false }
		}
	})
	const testResult: TestSentState = testMutation.data ? (testMutation.data.alreadySent ? 'already' : 'sent') : null
	// A test sent in this session wins over the server's record of an earlier one, so the button can
	// report which happened. Derived rather than copied in, so a saved alert shows its history on the
	// first render instead of after one.
	const testSent: TestSentState = testResult ?? (alertDetailQuery.data?.alert?.test_sent === true ? 'already' : null)

	const readinessBlock = getDeliveryReadinessBlock({
		channel: deliveryChannel,
		telegramLinked,
		slackTeamId,
		slackWorkspaceCount: activeWorkspaces.length
	})
	const saveBlockReason = !title.trim()
		? 'Name your alert'
		: isPriceAlert && priceValidationError
			? priceValidationError
			: getDeliveryBlockReason({
					channel: deliveryChannel,
					telegramLinked,
					slackTeamId,
					slackChannelId,
					slackWorkspaceCount: activeWorkspaces.length
				})

	const handleSave = () => {
		if (!messageId || saveBlockReason || isSaving) return
		saveAlert(
			buildArtifactSaveBody({
				messageId,
				alertId,
				title,
				...(isPriceAlert && editedTrigger
					? { trigger: editedTrigger }
					: { alertConfig: { frequency, hour, dayOfWeek, timezone } }),
				channel: deliveryChannel,
				slackTeamId,
				slackChannelId,
				slackChannelName
			})
		)
	}

	const handleTest = () => {
		if (!savedDbId || testSent) return
		if (testMutation.isError) setHasRetriedTest(true)
		testMutation.mutate(savedDbId)
	}

	const handleManageAlerts = () => {
		trackUmamiEvent('llamaai-alerts-open', { source: 'artifact' })
		openAlertsModal?.()
	}

	if (!isAuthenticated) {
		return (
			<div className="my-2 flex items-center gap-3 rounded-lg border border-subtle bg-surface p-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-tint text-warning">
					<Icon name="calendar-plus" className="size-4" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<h3 className="m-0 label-md text-primary">Sign in to save alerts</h3>
					<p className="m-0 body-sm text-secondary">Scheduled alerts require authentication.</p>
				</div>
			</div>
		)
	}

	const scheduleSummary = formatScheduleExpression(buildScheduleExpressionRaw({ frequency, hour, dayOfWeek, timezone }))
	const destinationLabel =
		deliveryChannel === 'telegram'
			? 'Telegram'
			: deliveryChannel === 'slack'
				? `Slack · #${slackChannelName ?? 'channel'}`
				: 'Email'
	const isCapHit = isAlertCapReachedError(saveError)

	return (
		<div
			className={`my-2 flex flex-col gap-3 rounded-lg border bg-surface p-3 ${
				isSaved ? 'border-subtle' : 'border-warning-strong ring-2 ring-(--bg-warning-tint)'
			}`}
		>
			<div className="flex items-center gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-tint text-warning">
					<Icon name="calendar-plus" className="size-4" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<h3 className="m-0 truncate label-md text-primary">
						{isSaved
							? title.trim() || (isPriceAlert ? 'Price alert' : 'Schedule alert')
							: isPriceAlert
								? 'Price alert'
								: 'Schedule alert'}
					</h3>
					<p className="m-0 truncate body-sm text-secondary">
						{getArtifactSubtitle(deliveryChannel, slackChannelName)}
					</p>
				</div>
			</div>

			{isSaved ? (
				<>
					<p
						// The saved card replaces the form and its Save button; the status line of a save made here takes focus.
						ref={savedAlert ? takeLostFocus : undefined}
						tabIndex={-1}
						className="m-0 flex items-center gap-1.5 body-sm text-success"
					>
						<Icon name="check" className="size-3.5 shrink-0" />
						{isPriceAlert
							? 'Watching continuously — fires within seconds of crossing'
							: savedNextRunAt
								? `Alert created — next run ${formatNextRunAt(savedNextRunAt)}`
								: 'Alert saved'}
					</p>

					<div className="flex flex-col gap-1.5 rounded-lg bg-surface-elevated-1 px-3 py-2.5">
						<p className="m-0 flex items-center gap-2 body-sm text-tertiary">
							<Icon name={isPriceAlert ? 'trending-up' : 'calendar'} className="size-3.5 shrink-0 text-tertiary" />
							<span className="truncate font-mono">
								{isPriceAlert && editedTrigger
									? formatPriceAlertSummary(editedTrigger, true, undefined, 0)
									: scheduleSummary}
							</span>
						</p>
						<p className="m-0 flex items-center gap-2 body-sm text-tertiary">
							<Icon name="mail" className="size-3.5 shrink-0 text-tertiary" />
							<span className="truncate">{destinationLabel}</span>
						</p>
					</div>

					{testMutation.isIdle && !testSent ? (
						<Button
							type="button"
							size="md"
							onClick={handleTest}
							disabled={alertDetailQuery.isLoading}
							className="w-full"
						>
							<Icon name="mail" className="size-3.5" />
							Send test alert
						</Button>
					) : null}

					{/* Each step of a test send replaces the control or line that had focus, so the next one takes it. The server's
					    record of an earlier test shows on load, where taking focus would pull the page to this card. */}
					{testSent === 'already' && !testMutation.isPending ? (
						<p
							ref={testResult ? takeLostFocus : undefined}
							tabIndex={-1}
							className="flex items-center justify-center gap-1.5 body-sm text-secondary"
						>
							<Icon name="check" className="size-3.5" />
							Test already sent for this alert
						</p>
					) : null}

					{testSent === 'sent' && !testMutation.isPending ? (
						<p
							ref={takeLostFocus}
							tabIndex={-1}
							className="flex items-center justify-center gap-1.5 body-sm text-success"
						>
							<Icon name="check" className="size-3.5" />
							{deliveryChannel === 'slack'
								? slackChannelName
									? `Test sent! Check #${slackChannelName} in Slack`
									: 'Test sent! Check your Slack channel'
								: deliveryChannel === 'telegram'
									? 'Test sent! Check your Telegram'
									: 'Test sent! Check your inbox'}
						</p>
					) : null}

					{testMutation.isPending ? (
						<p
							ref={takeLostFocus}
							tabIndex={-1}
							role="status"
							className="flex items-center justify-center gap-1.5 body-sm text-tertiary"
						>
							<LoadingSpinner size={12} />
							Sending test alert…
						</p>
					) : null}

					{testMutation.isError && !hasRetriedTest ? (
						<div className="flex flex-col items-center gap-1.5">
							<p className="body-sm text-error">{testMutation.error.message}</p>
							<Button ref={takeLostFocus} type="button" size="sm" onClick={handleTest}>
								Retry
							</Button>
						</div>
					) : null}

					{testMutation.isError && hasRetriedTest ? (
						<p ref={takeLostFocus} tabIndex={-1} className="text-center body-sm text-error">
							{testMutation.error.message}
						</p>
					) : null}

					{openAlertsModal ? (
						<span className="self-start label-sm">
							<Button type="button" variant="link" onClick={handleManageAlerts}>
								Manage alerts
								<Icon name="arrow-right" className="size-3.5" />
							</Button>
						</span>
					) : null}
				</>
			) : (
				<>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Alert title"
						aria-label="Alert title"
						className={alertInputClass}
					/>

					{prompt ? (
						<div className="flex flex-col gap-1">
							<span className={alertFieldLabelClass}>What it will tell you</span>
							<p className={`m-0 body-md text-secondary ${promptExpanded ? '' : 'line-clamp-2'}`}>{prompt}</p>
							{prompt.length > 140 ? (
								<span className="self-start label-sm">
									<Button variant="link" onClick={() => setPromptExpanded((v) => !v)} aria-expanded={promptExpanded}>
										{promptExpanded ? 'Show less' : 'Show more'}
									</Button>
								</span>
							) : null}
						</div>
					) : null}

					{trigger ? (
						<div className="flex flex-col gap-1.5">
							<div className="flex flex-wrap items-center gap-2">
								<span className="mono-md text-primary">{formatTokenLabel(trigger.token_nk)}</span>
								<SegmentedToggle<'above' | 'below'>
									label="Price comparison"
									value={priceOp}
									onChange={setPriceOp}
									options={PRICE_OPERATOR_OPTIONS}
								/>
								<PriceInput value={priceValue} onValueChange={setPriceValue} />
							</div>
							<p className="m-0 body-sm text-tertiary">Fires once, then pauses — re-arm it anytime from your alerts.</p>
						</div>
					) : (
						<div className="flex flex-wrap items-center gap-2">
							<select
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
									value={dayOfWeek}
									onChange={(e) => setDayOfWeek(Number(e.target.value))}
									aria-label="Day of week"
									className={inputStyles}
								>
									{DAYS_OF_WEEK.map((day, idx) => (
										<option key={day} value={idx}>
											{day}
										</option>
									))}
								</select>
							) : null}

							<span className="body-sm text-tertiary">at</span>

							<select
								value={hour}
								onChange={(e) => setHour(Number(e.target.value))}
								aria-label="Hour"
								className={inputStyles}
							>
								{Array.from({ length: 24 }, (_, h) => (
									<option key={`llamai-alert-h${h}`} value={h}>
										{h.toString().padStart(2, '0')}:00
									</option>
								))}
							</select>

							<select
								value={timezone}
								onChange={(e) => setTimezone(e.target.value)}
								aria-label="Timezone"
								className={inputStyles}
							>
								{timezoneOptions.map((tz) => (
									<option key={tz.value} value={tz.value}>
										{tz.label}
									</option>
								))}
							</select>
						</div>
					)}

					<div className="flex flex-col gap-1.5">
						<span className={alertFieldLabelClass}>Where should it go?</span>
						<div className="flex flex-wrap items-center gap-2">
							<SegmentedToggle<DeliveryChannel>
								label="Delivery channel"
								value={deliveryChannel}
								onChange={setDeliveryChannel}
								options={DELIVERY_OPTIONS}
							/>
							{isSlack ? (
								<>
									{slackWorkspacesQuery.isLoading ? (
										<span className="body-sm text-secondary">Loading workspaces…</span>
									) : activeWorkspaces.length > 0 ? (
										<select
											value={slackTeamId}
											onChange={(e) => {
												const nextTeamId = e.target.value
												const nextWorkspace = activeWorkspaces.find((w) => w.team_id === nextTeamId)
												setPickedSlack({ teamId: nextTeamId, channelId: nextWorkspace?.default_channel_id ?? '' })
											}}
											aria-label="Slack workspace"
											className={inputStyles}
										>
											<option value="" disabled>
												Pick workspace
											</option>
											{activeWorkspaces.map((w) => (
												<option key={w.team_id} value={w.team_id}>
													{w.team_name}
												</option>
											))}
										</select>
									) : null}
									{slackTeamId ? (
										queryReadFailed(slackChannelsQuery) ? (
											<RetryNotice
												message="Couldn't load Slack channels."
												retrying={slackChannelsQuery.isFetching}
												onRetry={() => void slackChannelsQuery.refetch()}
											/>
										) : slackChannelsQuery.isLoading ? (
											<span className="body-sm text-secondary">Loading channels…</span>
										) : (
											<select
												// A retried channel list takes the focus its Try again drops as it leaves.
												ref={takeLostFocus}
												value={slackChannelId}
												// The workspace travels with the channel, so a later workspace change cannot inherit it.
												onChange={(e) => setPickedSlack({ teamId: slackTeamId, channelId: e.target.value })}
												aria-label="Slack channel"
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
										)
									) : null}
								</>
							) : null}
						</div>
						{readinessBlock ? (
							<p className="m-0 body-sm text-warning">
								{readinessBlock.label} →{' '}
								<span className="text-tertiary">
									<SettingsIntegrationsLink />
								</span>
							</p>
						) : null}
					</div>

					<p className="m-0 flex items-center gap-1.5 body-sm text-warning">
						<Icon name="alert-triangle" className="size-3.5 shrink-0" />
						Action required — confirm your alert settings and save
					</p>

					{saveBlockReason && !readinessBlock ? (
						<p className="m-0 text-center body-sm text-tertiary">{saveBlockReason}</p>
					) : null}

					<Button
						type="button"
						size="md"
						variant="primary"
						onClick={handleSave}
						disabled={!messageId || !!saveBlockReason}
						pendingLabel={isSaving ? 'Saving…' : null}
						className="w-full"
					>
						<Icon name="calendar-plus" className="size-3.5" />
						Save alert
					</Button>

					{saveError ? (
						isCapHit ? (
							<div className="flex flex-col items-center gap-1.5">
								<p className="m-0 body-sm text-secondary">{getUpsellCopy(null)}</p>
								<BasicLink href="/subscription" className="label-sm text-link hover:underline">
									Upgrade to Pro
								</BasicLink>
							</div>
						) : (
							<p className="text-center body-sm text-error">{saveError.message}</p>
						)
					) : null}
				</>
			)}
		</div>
	)
}
