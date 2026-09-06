import { useMutation, useQuery } from '@tanstack/react-query'
import { memo, useEffect, useMemo, useState } from 'react'
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
	roundPriceValue,
	validatePriceTrigger,
	type ArtifactSaveBody
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
	alertSelectClass,
	PriceInput,
	SegmentedToggle,
	SettingsIntegrationsLink
} from '~/containers/LlamaAI/components/alerts/ui'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { useSlackChannels } from '~/containers/LlamaAI/hooks/useSlackChannels'
import { useSlackWorkspaces } from '~/containers/LlamaAI/hooks/useSlackIntegrationLink'
import type { AlertIntent } from '~/containers/LlamaAI/types'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

export const AlertArtifactLoading = memo(function AlertArtifactLoading() {
	return (
		<div className="my-2 flex flex-col gap-3 rounded-xl border border-ai-line-subtle bg-ai-surface-card p-3.5">
			<div className="flex items-center gap-3">
				<div className="size-10 shrink-0 animate-pulse rounded-xl bg-ai-skeleton" />
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<div className="h-4 w-28 animate-pulse rounded-sm bg-ai-skeleton" />
					<div className="h-3 w-44 animate-pulse rounded-sm bg-ai-skeleton" />
				</div>
			</div>
			<div className="h-10 w-full animate-pulse rounded-md bg-ai-skeleton" />
			<div className="flex flex-wrap items-center gap-2">
				<div className="h-10 w-20 animate-pulse rounded-md bg-ai-skeleton" />
				<div className="h-10 w-16 animate-pulse rounded-md bg-ai-skeleton" />
				<div className="ml-auto h-10 w-28 animate-pulse rounded-md bg-ai-skeleton" />
			</div>
		</div>
	)
})

interface AlertArtifactProps {
	alertId: string
	alertIntent: AlertIntent
	messageId?: string
	savedAlertIds?: Array<string>
	defaultTitle?: string
	prompt?: string
}

type TestSentState = 'sent' | 'already' | null

export const AlertArtifact = memo(function AlertArtifact({
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
	const [savedDbId, setSavedDbId] = useState<string | null>(savedAlertIds?.includes(alertId) ? alertId : null)
	const [savedNextRunAt, setSavedNextRunAt] = useState<string | null>(null)
	const [hasRetriedTest, setHasRetriedTest] = useState(false)
	const [testSent, setTestSent] = useState<TestSentState>(null)
	const [promptExpanded, setPromptExpanded] = useState(false)

	const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>(alertIntent.deliveryChannel || 'email')
	const isSlack = deliveryChannel === 'slack'
	const [slackTeamId, setSlackTeamId] = useState<string>(alertIntent.slackTeamId ?? '')
	const [slackChannelId, setSlackChannelId] = useState<string>(alertIntent.slackChannelId ?? '')
	const telegramLink = useIntegrationLink()
	const telegramLinked = telegramLink.state.status === 'linked'
	const slackWorkspacesQuery = useSlackWorkspaces()
	const slackChannelsQuery = useSlackChannels(isSlack && slackTeamId ? slackTeamId : null)
	const activeWorkspaces = useMemo(() => {
		const workspaces = slackWorkspacesQuery.data?.workspaces ?? []
		return workspaces.filter((w) => !w.revoked)
	}, [slackWorkspacesQuery.data?.workspaces])
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
	const selectedChannel = (slackChannels ?? []).find((c) => c.id === slackChannelId) ?? null
	const slackChannelName = selectedChannel?.name ?? alertIntent.slackChannelName ?? null
	const isSaved = savedDbId !== null
	const priceValidationError = trigger ? validatePriceTrigger({ tokenNk: trigger.token_nk, value: priceValue }) : null
	const editedTrigger: PriceTrigger | null = trigger ? { ...trigger, op: priceOp, value: Number(priceValue) } : null

	useEffect(() => {
		if (!isSlack || slackTeamId || activeWorkspaces.length !== 1) return
		setSlackTeamId(activeWorkspaces[0].team_id)
		if (!slackChannelId && activeWorkspaces[0].default_channel_id) {
			setSlackChannelId(activeWorkspaces[0].default_channel_id)
		}
	}, [isSlack, slackTeamId, slackChannelId, activeWorkspaces])

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

	useEffect(() => {
		if (alertDetailQuery.data?.alert?.test_sent === true) setTestSent((prev) => prev ?? 'already')
	}, [alertDetailQuery.data?.alert?.test_sent])

	const {
		mutate: saveAlert,
		isPending: isSaving,
		error: saveError
	} = useMutation({
		mutationFn: async (payload: ArtifactSaveBody) => {
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
		onSuccess: (data: any) => {
			trackUmamiEvent('llamaai-alert-created', { type: isPriceAlert ? 'price' : 'schedule', source: 'artifact' })
			setSavedDbId(data.id)
			const nextRunAt = data.nextRunAt ?? data.next_run_at
			if (typeof nextRunAt === 'string' && nextRunAt) setSavedNextRunAt(nextRunAt)
		}
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
		},
		onSuccess: (data) => {
			setTestSent(data.alreadySent ? 'already' : 'sent')
		}
	})

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
			<div className="my-2 flex items-center gap-3 rounded-xl border border-ai-line-subtle bg-ai-surface-card p-3.5">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-ai-warning-bright/20 to-ai-warning-bright/5 ring-1 ring-ai-warning-bright/20 ring-inset">
					<Icon name="calendar-plus" className="size-[18px] text-ai-warning-bright" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<h3 className="m-0 text-sm font-medium text-(--text1)">Sign in to save alerts</h3>
					<p className="m-0 text-xs text-(--text3)">Scheduled alerts require authentication.</p>
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
			className={`my-2 flex flex-col gap-3 rounded-xl border p-3.5 ${
				isSaved
					? 'border-ai-line-subtle bg-ai-surface-card'
					: 'animate-[alertPulse_2s_ease-in-out_infinite] border-ai-warning-bright/40 bg-ai-surface-card'
			}`}
			style={
				!isSaved
					? ({
							'--tw-shadow': '0 0 0 0 rgba(245, 158, 11, 0)',
							animation: 'alertPulse 2s ease-in-out infinite'
						} as React.CSSProperties)
					: undefined
			}
		>
			<style>{`
				@keyframes alertPulse {
					0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.15); }
					50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1); }
				}
			`}</style>
			<div className="flex items-center gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-ai-warning-bright/20 to-ai-warning-bright/5 ring-1 ring-ai-warning-bright/20 ring-inset">
					<Icon name="calendar-plus" className="size-[18px] text-ai-warning-bright" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<h3 className="m-0 truncate text-sm font-semibold tracking-tight text-(--text1)">
						{isSaved
							? title.trim() || (isPriceAlert ? 'Price alert' : 'Schedule alert')
							: isPriceAlert
								? 'Price alert'
								: 'Schedule alert'}
					</h3>
					<p className="m-0 truncate text-xs text-(--text3)">
						{getArtifactSubtitle(deliveryChannel, slackChannelName)}
					</p>
				</div>
			</div>

			{isSaved ? (
				<>
					<p className="m-0 flex items-center gap-1.5 text-xs text-ai-success">
						<Icon name="check" className="size-3.5 shrink-0" />
						{isPriceAlert
							? 'Watching continuously — fires within seconds of crossing'
							: savedNextRunAt
								? `Alert created — next run ${formatNextRunAt(savedNextRunAt)}`
								: 'Alert saved'}
					</p>

					<div className="flex flex-col gap-1.5 rounded-lg bg-ai-hover-faint px-3 py-2.5">
						<p className="m-0 flex items-center gap-2 text-xs text-ai-tertiary">
							<Icon name={isPriceAlert ? 'trending-up' : 'calendar'} className="size-3.5 shrink-0 text-ai-muted" />
							<span className="truncate font-mono">
								{isPriceAlert && editedTrigger
									? formatPriceAlertSummary(editedTrigger, true, undefined, 0)
									: scheduleSummary}
							</span>
						</p>
						<p className="m-0 flex items-center gap-2 text-xs text-ai-tertiary">
							<Icon name="mail" className="size-3.5 shrink-0 text-ai-muted" />
							<span className="truncate">{destinationLabel}</span>
						</p>
					</div>

					{testMutation.isIdle && !testSent ? (
						<button
							type="button"
							onClick={handleTest}
							disabled={alertDetailQuery.isLoading}
							className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ai-line-medium px-4 py-2 text-sm font-medium text-(--text1) transition-colors hover:bg-ai-hover disabled:opacity-50"
						>
							<Icon name="mail" className="size-4" />
							<span>Send test alert</span>
						</button>
					) : null}

					{testSent === 'already' && !testMutation.isPending ? (
						<p className="flex items-center justify-center gap-1.5 text-xs text-(--text3)">
							<Icon name="check" className="size-3.5" />
							Test already sent for this alert
						</p>
					) : null}

					{testSent === 'sent' && !testMutation.isPending ? (
						<p className="flex items-center justify-center gap-1.5 text-xs text-ai-success">
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
						<p className="flex items-center justify-center gap-1.5 text-xs text-(--text3)">
							<span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
							Sending test alert...
						</p>
					) : null}

					{testMutation.isError && !hasRetriedTest ? (
						<div className="flex flex-col items-center gap-1.5">
							<p className="text-xs text-error">{testMutation.error.message}</p>
							<button type="button" onClick={handleTest} className="text-xs font-medium text-link hover:underline">
								Retry
							</button>
						</div>
					) : null}

					{testMutation.isError && hasRetriedTest ? (
						<p className="text-center text-xs text-error">{testMutation.error.message}</p>
					) : null}

					{openAlertsModal ? (
						<button
							type="button"
							onClick={handleManageAlerts}
							className="self-start text-xs text-ai-tertiary transition-colors hover:text-link"
						>
							Manage alerts →
						</button>
					) : null}
				</>
			) : (
				<>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Alert title"
						className={alertInputClass}
					/>

					{prompt ? (
						<div className="flex flex-col gap-1">
							<span className={alertFieldLabelClass}>What it will tell you</span>
							<p className={`m-0 text-sm leading-relaxed text-ai-secondary ${promptExpanded ? '' : 'line-clamp-2'}`}>
								{prompt}
							</p>
							{prompt.length > 140 ? (
								<button
									type="button"
									onClick={() => setPromptExpanded((v) => !v)}
									className="self-start text-xs font-medium text-link hover:underline"
								>
									{promptExpanded ? 'Show less' : 'Show more'}
								</button>
							) : null}
						</div>
					) : null}

					{trigger ? (
						<div className="flex flex-col gap-1.5">
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-mono text-sm text-primary">{formatTokenLabel(trigger.token_nk)}</span>
								<SegmentedToggle<'above' | 'below'>
									value={priceOp}
									onChange={setPriceOp}
									options={[
										{ value: 'above', label: 'Above' },
										{ value: 'below', label: 'Below' }
									]}
								/>
								<PriceInput value={priceValue} onValueChange={setPriceValue} />
							</div>
							<p className="m-0 text-xs text-ai-muted">Fires once, then pauses — re-arm it anytime from your alerts.</p>
						</div>
					) : (
						<div className="flex flex-wrap items-center gap-2">
							<select
								value={frequency}
								onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
								className={alertSelectClass}
							>
								<option value="daily">Daily</option>
								<option value="weekly">Weekly</option>
							</select>

							{frequency === 'weekly' ? (
								<select
									value={dayOfWeek}
									onChange={(e) => setDayOfWeek(Number(e.target.value))}
									className={alertSelectClass}
								>
									{DAYS_OF_WEEK.map((day, idx) => (
										<option key={day} value={idx}>
											{day}
										</option>
									))}
								</select>
							) : null}

							<span className="text-xs text-ai-muted">at</span>

							<select value={hour} onChange={(e) => setHour(Number(e.target.value))} className={alertSelectClass}>
								{Array.from({ length: 24 }, (_, h) => (
									<option key={`llamai-alert-h${h}`} value={h}>
										{h.toString().padStart(2, '0')}:00
									</option>
								))}
							</select>

							<select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={alertSelectClass}>
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
								value={deliveryChannel}
								onChange={setDeliveryChannel}
								options={[
									{ value: 'email', label: 'Email' },
									{ value: 'telegram', label: 'Telegram' },
									{ value: 'slack', label: 'Slack' }
								]}
							/>
							{isSlack ? (
								<>
									{slackWorkspacesQuery.isLoading ? (
										<span className="text-xs text-(--text3)">Loading workspaces…</span>
									) : activeWorkspaces.length > 0 ? (
										<select
											value={slackTeamId}
											onChange={(e) => {
												const nextTeamId = e.target.value
												setSlackTeamId(nextTeamId)
												const nextWorkspace = activeWorkspaces.find((w) => w.team_id === nextTeamId)
												setSlackChannelId(nextWorkspace?.default_channel_id ?? '')
											}}
											className={alertSelectClass}
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
										slackChannelsQuery.isLoading ? (
											<span className="text-xs text-(--text3)">Loading channels…</span>
										) : slackChannelsQuery.isError ? (
											<span className="text-xs text-ai-error-vivid">Failed to load channels</span>
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
										)
									) : null}
								</>
							) : null}
						</div>
						{readinessBlock ? (
							<p className="m-0 text-xs text-ai-warning">
								{readinessBlock.label} →{' '}
								<span className="text-ai-tertiary">
									<SettingsIntegrationsLink />
								</span>
							</p>
						) : null}
					</div>

					<p className="m-0 flex items-center gap-1.5 text-xs text-ai-warning">
						<Icon name="alert-triangle" className="size-3.5 shrink-0" />
						Action required — confirm your alert settings and save
					</p>

					{saveBlockReason && !readinessBlock ? (
						<p className="m-0 text-center text-xs text-ai-muted">{saveBlockReason}</p>
					) : null}

					<button
						type="button"
						onClick={handleSave}
						disabled={!messageId || isSaving || !!saveBlockReason}
						className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-ai-white transition-colors hover:bg-ai-action-hover disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSaving ? (
							<span>Saving...</span>
						) : (
							<>
								<Icon name="calendar-plus" className="size-4" />
								<span>Save Alert</span>
							</>
						)}
					</button>

					{saveError ? (
						isCapHit ? (
							<div className="flex flex-col items-center gap-1.5">
								<p className="m-0 text-xs text-ai-tertiary">{getUpsellCopy(null)}</p>
								<BasicLink href="/subscription" className="text-xs font-medium text-link hover:underline">
									Upgrade to Pro
								</BasicLink>
							</div>
						) : (
							<p className="text-center text-xs text-error">{saveError.message}</p>
						)
					) : null}
				</>
			)}
		</div>
	)
})
