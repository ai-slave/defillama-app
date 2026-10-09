import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { AI_SERVER } from '~/constants'
import {
	type AlertSchedule,
	AlertScheduleFields,
	SlackTargetPickers
} from '~/containers/LlamaAI/components/alerts/AlertScheduleFields'
import { formatPriceAlertSummary, formatTokenLabel } from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import {
	type ArtifactSaveBody,
	buildArtifactSaveBody,
	buildScheduleExpressionRaw,
	formatNextRunAt,
	getArtifactSubtitle,
	getDeliveryError,
	getDeliveryReadinessBlock,
	getSlackListGate,
	getUpsellCopy,
	isAlertCapReachedError,
	resolveSlackChannelName,
	resolveSlackTarget,
	roundPriceValue,
	type SlackTarget,
	validatePrice
} from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { formatScheduleExpression } from '~/containers/LlamaAI/components/alerts/schedule'
import type { DeliveryChannel, PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import {
	alertFieldLabelClass,
	PriceInput,
	SegmentedToggle,
	PRICE_OPERATOR_OPTIONS,
	DELIVERY_OPTIONS,
	SettingsIntegrationsLink
} from '~/containers/LlamaAI/components/alerts/ui'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { useSlackChannels } from '~/containers/LlamaAI/hooks/useSlackChannels'
import { useSlackWorkspaces } from '~/containers/LlamaAI/hooks/useSlackIntegrationLink'
import type { AlertIntent } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { Field, FieldGroup } from '~/ui/Field'
import { showFieldErrors, takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { Skeleton } from '~/ui/Skeleton'
import { InlineStatus } from '~/ui/Status'
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
	const [schedule, setSchedule] = useState<AlertSchedule>({
		frequency: alertIntent.frequency ?? 'daily',
		hour: alertIntent.hour ?? 9,
		dayOfWeek: alertIntent.dayOfWeek ?? 1,
		timezone: alertIntent.timezone ?? 'UTC'
	})
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
	const slackChannelName = resolveSlackChannelName({
		channelId: slackChannelId,
		channels: slackChannels,
		intentChannelId: alertIntent.slackChannelId,
		intentChannelName: alertIntent.slackChannelName
	})
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
	const [submitted, setSubmitted] = useState(false)
	const errors = {
		title: title.trim() ? null : 'Enter a name for the alert.',
		price: isPriceAlert ? validatePrice(priceValue) : null,
		delivery: getDeliveryError({
			channel: deliveryChannel,
			telegramLinked,
			slackTeamId,
			slackChannelId,
			slackWorkspaceCount: activeWorkspaces.length
		})
	}
	const shown = submitted ? errors : null
	const slackGate = getSlackListGate({
		channel: deliveryChannel,
		slackTeamId,
		slackChannelId,
		workspacesLoading: slackWorkspacesQuery.isLoading,
		channelsLoading: slackChannelsQuery.isLoading,
		channelsFailed: queryReadFailed(slackChannelsQuery)
	})

	const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!messageId || isSaving || slackGate) return
		if (errors.title || errors.price || errors.delivery) {
			return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		}
		saveAlert(
			buildArtifactSaveBody({
				messageId,
				alertId,
				title,
				...(isPriceAlert && editedTrigger ? { trigger: editedTrigger } : { alertConfig: schedule }),
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

	const scheduleSummary = formatScheduleExpression(buildScheduleExpressionRaw(schedule))
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
						className="m-0 flex items-start gap-1.5 body-sm text-success"
					>
						<span className="flex h-lh shrink-0 items-center">
							<Icon name="check" className="size-3.5" />
						</span>
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
							className="flex items-start justify-center gap-1.5 body-sm text-secondary"
						>
							<span className="flex h-lh shrink-0 items-center">
								<Icon name="check" className="size-3.5" />
							</span>
							Test already sent for this alert
						</p>
					) : null}

					{testSent === 'sent' && !testMutation.isPending ? (
						<p
							ref={takeLostFocus}
							tabIndex={-1}
							className="flex items-start justify-center gap-1.5 body-sm text-success"
						>
							<span className="flex h-lh shrink-0 items-center">
								<Icon name="check" className="size-3.5" />
							</span>
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
						<InlineStatus
							variant="error"
							action={
								<Button ref={takeLostFocus} type="button" size="sm" onClick={handleTest}>
									Try again
								</Button>
							}
						>
							{testMutation.error.message}
						</InlineStatus>
					) : null}

					{testMutation.isError && hasRetriedTest ? (
						<div ref={takeLostFocus} tabIndex={-1}>
							<InlineStatus variant="error">{testMutation.error.message}</InlineStatus>
						</div>
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
				<form noValidate onSubmit={handleSave} className="contents">
					<Field label="Name" error={shown?.title}>
						{(control) => (
							<Input
								{...control}
								required
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Alert title"
								className="w-full"
							/>
						)}
					</Field>

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
						<Field
							label="Fires when the price goes"
							hint="Fires once, then pauses — re-arm it anytime from your alerts."
							error={shown?.price}
						>
							{(control) => (
								<div className="flex flex-wrap items-center gap-2">
									<span className="mono-md text-primary">{formatTokenLabel(trigger.token_nk)}</span>
									<SegmentedToggle<'above' | 'below'>
										label="Price comparison"
										value={priceOp}
										onChange={setPriceOp}
										options={PRICE_OPERATOR_OPTIONS}
									/>
									<PriceInput value={priceValue} onValueChange={setPriceValue} control={control} />
								</div>
							)}
						</Field>
					) : (
						<AlertScheduleFields label="Schedule" schedule={schedule} onChange={setSchedule} />
					)}

					<FieldGroup
						label="Where should it go?"
						hint={
							readinessBlock ? (
								<span className="text-warning">
									{readinessBlock.label} →{' '}
									<span className="text-tertiary">
										<SettingsIntegrationsLink />
									</span>
								</span>
							) : null
						}
						error={shown?.delivery}
					>
						<div className="flex flex-wrap items-center gap-2">
							<SegmentedToggle<DeliveryChannel>
								label="Delivery channel"
								value={deliveryChannel}
								onChange={setDeliveryChannel}
								options={DELIVERY_OPTIONS}
							/>
							{isSlack ? (
								<SlackTargetPickers
									workspaces={activeWorkspaces}
									workspacesLoading={slackWorkspacesQuery.isLoading}
									target={{ teamId: slackTeamId, channelId: slackChannelId }}
									channelsQuery={slackChannelsQuery}
									invalid={!!shown?.delivery}
									onPick={setPickedSlack}
								/>
							) : null}
						</div>
					</FieldGroup>

					<p className="m-0 flex items-start gap-1.5 body-sm text-warning">
						<span className="flex h-lh shrink-0 items-center">
							<Icon name="alert-triangle" className="size-3.5" />
						</span>
						Action required — confirm your alert settings and save
					</p>

					<Button
						type="submit"
						size="md"
						variant="primary"
						// A failed channel list holds Save; its notice and Try again sit in the delivery field.
						disabled={!messageId || slackGate === 'channelsFailed'}
						accessibleWhenDisabled={slackGate === 'channelsFailed'}
						pendingLabel={isSaving ? 'Saving…' : slackGate === 'channelsFailed' ? null : slackGate}
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
							<InlineStatus variant="error">{saveError.message}</InlineStatus>
						)
					) : null}
				</form>
			)}
		</div>
	)
}
