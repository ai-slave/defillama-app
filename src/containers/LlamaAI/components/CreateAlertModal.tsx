import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { BasicLink } from '~/components/Link'
import { ReactSelect } from '~/components/MultiSelect/ReactSelect'
import { createManualAlert } from '~/containers/LlamaAI/components/alerts/api'
import {
	ALERT_PROMPT_SUGGESTIONS,
	buildCreateAlertBody,
	buildJustAskExample,
	buildScheduleExpressionRaw,
	deriveAlertTitle,
	formatPriceLabel,
	getDeliveryReadinessBlock,
	getPriceCaption,
	getSubmitBlockReason,
	getUpsellCopy,
	isAlertCapReachedError,
	roundPriceValue,
	type PriceOp,
	type TriggerType
} from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { ALERTS_QUERY_KEY } from '~/containers/LlamaAI/components/alerts/queryKeys'
import {
	DAYS_OF_WEEK,
	formatScheduleExpression,
	getTimezoneLabel,
	getUserTimezone,
	GMT_OFFSETS
} from '~/containers/LlamaAI/components/alerts/schedule'
import type { DeliveryChannel } from '~/containers/LlamaAI/components/alerts/types'
import {
	alertBackdropClass,
	alertDialogClass,
	alertFieldLabelClass,
	alertGhostButtonClass,
	alertInputClass,
	alertPrimaryButtonClass,
	alertSelectClass,
	AlertsDialogHeader,
	PriceInput,
	SegmentedToggle,
	SettingsIntegrationsLink
} from '~/containers/LlamaAI/components/alerts/ui'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { SESSIONS_QUERY_KEY, useSessionList } from '~/containers/LlamaAI/hooks/useSessionList'
import { useSlackChannels } from '~/containers/LlamaAI/hooks/useSlackChannels'
import { useSlackWorkspaces } from '~/containers/LlamaAI/hooks/useSlackIntegrationLink'
import { useTokenSearch } from '~/containers/ProDashboard/components/datasets/TokenUsageDataset/useTokenSearch'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface CreateAlertModalProps {
	dialogStore: Ariakit.DialogStore
	initialTab?: TriggerType
	prefill?: { token_nk: string; symbol: string; value: number; op?: PriceOp; currentPrice?: number }
	onCreated?: (alert: { id: string; alertExpression?: string; nextRunAt?: string }) => void
	onJustAsk?: (exampleText: string) => void
}

function AlertTypeCard({
	active,
	onClick,
	icon,
	title,
	description
}: {
	active: boolean
	onClick: () => void
	icon: 'calendar' | 'trending-up'
	title: string
	description: string
}) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={active}
			onClick={onClick}
			className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
				active
					? 'border-link/40 bg-link/4 ring-1 ring-link/30'
					: 'border-ai-line-medium hover:border-ai-line-strong hover:bg-ai-hover-faint'
			}`}
		>
			<span
				className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
					active ? 'bg-link/10 text-link' : 'bg-ai-hover text-ai-muted'
				}`}
			>
				<Icon name={icon} className="size-3.5" />
			</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className={`text-sm font-medium ${active ? 'text-link' : 'text-primary'}`}>{title}</span>
				<span className="text-xs leading-snug text-ai-tertiary">{description}</span>
			</span>
		</button>
	)
}

const TokenOptionRow = ({ innerProps, label, data }: any) => (
	<div {...innerProps} className="flex cursor-pointer items-center gap-2 p-2">
		{data.logo ? (
			<img src={data.logo} alt="" width={18} height={18} className="size-[18px] rounded-full" />
		) : (
			<div className="size-[18px] rounded-full bg-(--bg-tertiary)" />
		)}
		<span className="text-sm">{label}</span>
		{typeof data.price === 'number' ? (
			<span className="ml-auto pl-3 font-mono text-xs text-ai-muted">{formatPriceLabel(data.price)}</span>
		) : null}
	</div>
)

export const CreateAlertModal = memo(function CreateAlertModal({
	dialogStore,
	initialTab,
	prefill,
	onCreated,
	onJustAsk
}: CreateAlertModalProps) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const router = useRouter()
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')
	const { alertsUsage } = useSessionList()

	const [triggerType, setTriggerType] = useState<TriggerType>(initialTab ?? (prefill ? 'price' : 'schedule'))
	const [prompt, setPrompt] = useState('')

	const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')
	const [hour, setHour] = useState(9)
	const [dayOfWeek, setDayOfWeek] = useState(1)
	const [timezone, setTimezone] = useState(() => getUserTimezone())

	const [tokenSearchInput, setTokenSearchInput] = useState('')
	const [priceToken, setPriceToken] = useState<{
		tokenNk: string
		symbol: string
		currentPrice?: number | null
	} | null>(
		prefill ? { tokenNk: prefill.token_nk, symbol: prefill.symbol, currentPrice: prefill.currentPrice ?? null } : null
	)
	const [priceValue, setPriceValue] = useState(prefill ? roundPriceValue(prefill.value) : '')
	const [priceOp, setPriceOp] = useState<PriceOp>(prefill?.op ?? 'above')

	const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>('email')
	const [slackTeamId, setSlackTeamId] = useState('')
	const [slackChannelId, setSlackChannelId] = useState('')

	const generationRef = useRef(0)
	const pendingSubmissionGenerationRef = useRef<number | null>(null)

	const { data: tokenOptionsResponse, isLoading: isLoadingTokens } = useTokenSearch(tokenSearchInput, true)
	const tokenOptions = tokenOptionsResponse ?? []

	const telegramLink = useIntegrationLink()
	const telegramLinked = telegramLink.state.status === 'linked'

	const slackWorkspacesQuery = useSlackWorkspaces()
	const slackChannelsQuery = useSlackChannels(deliveryChannel === 'slack' && slackTeamId ? slackTeamId : null)
	const activeSlackWorkspaces = useMemo(() => {
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

	useEffect(() => {
		if (deliveryChannel !== 'slack' || slackTeamId || activeSlackWorkspaces.length !== 1) return
		const workspace = activeSlackWorkspaces[0]
		if (!workspace) return
		setSlackTeamId(workspace.team_id)
		if (workspace.default_channel_id) setSlackChannelId(workspace.default_channel_id)
	}, [deliveryChannel, slackTeamId, activeSlackWorkspaces])

	const createAlertMutation = useMutation<
		{ id: string; alertExpression: string; nextRunAt: string },
		Error,
		ReturnType<typeof buildCreateAlertBody>
	>({
		mutationFn: async (body) => {
			if (!authorizedFetch) throw new Error('Not authenticated')
			return await createManualAlert(authorizedFetch, body)
		},
		onSuccess: (data, variables) => {
			trackUmamiEvent('llamaai-alert-created', { type: variables.trigger.type, source: 'form' })
			void queryClient.invalidateQueries({ queryKey: [ALERTS_QUERY_KEY] })
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
			toast.success('Alert created')
			if (!isOpen || pendingSubmissionGenerationRef.current !== generationRef.current) return
			onCreated?.(data)
			dialogStore.hide()
		}
	})

	useEffect(() => {
		if (!isOpen) return
		generationRef.current += 1
		const openTab = initialTab ?? (prefill ? 'price' : 'schedule')
		setTriggerType(openTab)
		setPrompt('')
		setFrequency('daily')
		setHour(9)
		setDayOfWeek(1)
		setTimezone(getUserTimezone())
		setTokenSearchInput('')
		setPriceToken(
			prefill ? { tokenNk: prefill.token_nk, symbol: prefill.symbol, currentPrice: prefill.currentPrice ?? null } : null
		)
		setPriceValue(prefill ? roundPriceValue(prefill.value) : '')
		setPriceOp(prefill?.op ?? 'above')
		setDeliveryChannel('email')
		setSlackTeamId('')
		setSlackChannelId('')
		createAlertMutation.reset()
		trackUmamiEvent('llamaai-alert-create-open', { tab: openTab })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen])

	const readinessBlock = getDeliveryReadinessBlock({
		channel: deliveryChannel,
		telegramLinked,
		slackTeamId,
		slackWorkspaceCount: activeSlackWorkspaces.length
	})

	const submitBlockReason = getSubmitBlockReason({
		triggerType,
		prompt,
		price: { tokenNk: priceToken?.tokenNk ?? null, value: priceValue },
		delivery: {
			channel: deliveryChannel,
			telegramLinked,
			slackTeamId,
			slackChannelId,
			slackWorkspaceCount: activeSlackWorkspaces.length
		}
	})

	const isUpsell = alertsUsage?.allowed === false || isAlertCapReachedError(createAlertMutation.error)
	const otherErrorMessage = createAlertMutation.error && !isUpsell ? createAlertMutation.error.message : null

	const derivedTitle = deriveAlertTitle({
		triggerType,
		prompt,
		symbol: priceToken?.symbol ?? null,
		op: priceOp,
		value: priceValue
	})

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (submitBlockReason || createAlertMutation.isPending) return
		const titleValue = new FormData(e.currentTarget).get('title')
		const slackChannelName = slackChannels?.find((c) => c.id === slackChannelId)?.name ?? null
		const body = buildCreateAlertBody({
			title: (typeof titleValue === 'string' ? titleValue.trim() : '') || derivedTitle,
			triggerType,
			prompt,
			schedule: { frequency, hour, dayOfWeek, timezone },
			price: { tokenNk: priceToken?.tokenNk ?? '', value: priceValue, op: priceOp },
			delivery: { channel: deliveryChannel, slackTeamId, slackChannelId, slackChannelName }
		})
		pendingSubmissionGenerationRef.current = generationRef.current
		createAlertMutation.mutate(body)
	}

	const handleJustAsk = () => {
		const example = buildJustAskExample({
			triggerType,
			frequency,
			prompt,
			symbol: priceToken?.symbol ?? null,
			op: priceOp,
			value: priceValue
		})
		onJustAsk?.(example)
		dialogStore.hide()
	}

	const channelSummary =
		deliveryChannel === 'telegram'
			? 'Telegram'
			: deliveryChannel === 'slack'
				? slackChannelId
					? `Slack #${slackChannels?.find((c) => c.id === slackChannelId)?.name ?? 'channel'}`
					: 'Slack'
				: 'Email'
	const triggerSummary =
		triggerType === 'schedule'
			? `Runs ${formatScheduleExpression(buildScheduleExpressionRaw({ frequency, hour, dayOfWeek, timezone }))}`
			: getPriceCaption(priceToken?.symbol.toUpperCase() ?? 'the token', priceOp, priceValue || '0')
	const currentPrice = priceToken?.currentPrice

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				className={alertDialogClass}
				backdrop={<div className={alertBackdropClass} />}
				portal
				unmountOnHide
			>
				<AlertsDialogHeader title="New alert" subtitle="Get pinged when things move" />

				<div className="flex min-h-0 flex-1 flex-col">
					{isUpsell ? (
						<div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-5 py-14 text-center">
							<div className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-ai-warning-bright/20 to-ai-warning-bright/5 ring-1 ring-ai-warning-bright/20 ring-inset">
								<Icon name="alert-triangle" className="size-6 text-ai-warning-bright" />
							</div>
							<p className="m-0 text-base font-semibold tracking-tight text-ai-primary">Alert limit reached</p>
							<p className="m-0 max-w-xs text-xs text-ai-tertiary">{getUpsellCopy(alertsUsage)}</p>
							<BasicLink
								href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
								onClick={() => {
									setSignupSource('alert-limit')
									trackUmamiEvent('llamaai-alert-upsell', { action: 'upgrade' })
									dialogStore.hide()
								}}
								className={`mt-2 ${alertPrimaryButtonClass}`}
							>
								Upgrade to Pro
							</BasicLink>
							<button
								type="button"
								onClick={() => dialogStore.hide()}
								className="text-xs text-ai-tertiary hover:underline"
							>
								Maybe later
							</button>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
							<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-3.5">
								<div role="radiogroup" aria-label="Alert type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
									<AlertTypeCard
										active={triggerType === 'schedule'}
										onClick={() => setTriggerType('schedule')}
										icon="calendar"
										title="Scheduled report"
										description="Answers a question of yours every day or week"
									/>
									<AlertTypeCard
										active={triggerType === 'price'}
										onClick={() => setTriggerType('price')}
										icon="trending-up"
										title="Price alert"
										description="Instant ping when a token crosses your level"
									/>
								</div>

								{triggerType === 'schedule' ? (
									<div className="flex flex-col gap-2">
										<label htmlFor="create-alert-prompt" className="text-sm font-medium text-primary">
											What should it tell you?
										</label>
										<textarea
											id="create-alert-prompt"
											autoFocus
											value={prompt}
											onChange={(e) => setPrompt(e.target.value)}
											rows={2}
											placeholder="Hyperliquid TVL and its top drivers"
											className={`${alertInputClass} resize-none`}
										/>
										<div className="flex flex-wrap gap-1.5">
											{ALERT_PROMPT_SUGGESTIONS.map((suggestion) => (
												<button
													key={suggestion.label}
													type="button"
													onClick={() => {
														setPrompt(suggestion.prompt)
														trackUmamiEvent('llamaai-alert-suggestion', { label: suggestion.label })
													}}
													data-active={prompt === suggestion.prompt}
													className="rounded-full border border-ai-line-medium px-2.5 py-1 text-xs text-ai-tertiary transition-colors hover:border-ai-line-strong hover:text-primary data-[active=true]:border-link/40 data-[active=true]:bg-link/6 data-[active=true]:text-link dark:hover:text-ai-primary"
												>
													{suggestion.label}
												</button>
											))}
										</div>
									</div>
								) : (
									<div className="flex flex-col gap-2">
										<span className="text-sm font-medium text-primary">When should it fire?</span>
										<ReactSelect
											placeholder="Search tokens..."
											value={priceToken ? { value: priceToken.symbol, label: priceToken.symbol.toUpperCase() } : null}
											onChange={(option: any) => {
												if (!option) {
													setPriceToken(null)
													return
												}
												setPriceToken({
													tokenNk: `coingecko:${option.id}`,
													symbol: option.value,
													currentPrice: typeof option.price === 'number' ? option.price : null
												})
											}}
											onInputChange={(value: string) => setTokenSearchInput(value)}
											options={tokenOptions}
											isLoading={isLoadingTokens}
											isClearable
											components={{ Option: TokenOptionRow }}
										/>
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-xs text-ai-muted">goes</span>
											<SegmentedToggle<PriceOp>
												value={priceOp}
												onChange={setPriceOp}
												options={[
													{ value: 'above', label: 'Above' },
													{ value: 'below', label: 'Below' }
												]}
											/>
											<PriceInput value={priceValue} onValueChange={setPriceValue} />
										</div>
										{currentPrice ? (
											<button
												type="button"
												onClick={() => setPriceValue(roundPriceValue(currentPrice))}
												className="self-start text-xs text-ai-tertiary transition-colors hover:text-link"
											>
												{priceToken.symbol.toUpperCase()} is trading around{' '}
												<span className="font-mono font-medium text-primary">{formatPriceLabel(currentPrice)}</span> —
												tap to use
											</button>
										) : (
											<p className="m-0 text-xs text-ai-muted">
												Fires once, then pauses — re-arm it anytime from your alerts.
											</p>
										)}
									</div>
								)}

								<div className="overflow-hidden rounded-xl border border-ai-line-subtle bg-ai-hover-faint">
									{triggerType === 'schedule' ? (
										<div className="flex flex-col gap-1.5 px-4 py-2.5">
											<span className={alertFieldLabelClass}>When should it arrive?</span>
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
												<select
													value={hour}
													onChange={(e) => setHour(Number(e.target.value))}
													className={alertSelectClass}
												>
													{Array.from({ length: 24 }, (_, h) => (
														<option key={h} value={h}>
															{h.toString().padStart(2, '0')}:00
														</option>
													))}
												</select>
												<select
													value={timezone}
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
									) : (
										<div className="flex flex-col gap-1.5 px-4 py-2.5">
											<label htmlFor="create-alert-prompt" className={alertFieldLabelClass}>
												Add context to the ping <span className="font-normal text-ai-muted">(optional)</span>
											</label>
											<textarea
												id="create-alert-prompt"
												value={prompt}
												onChange={(e) => setPrompt(e.target.value)}
												rows={1}
												placeholder="ETH price, gas, and what moved the market"
												className={`${alertInputClass} resize-none`}
											/>
										</div>
									)}
									<div className="mx-4 h-px bg-ai-hover" />
									<div className="flex flex-col gap-1.5 px-4 py-2.5">
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
											{deliveryChannel === 'slack' ? (
												<>
													{slackWorkspacesQuery.isLoading ? (
														<span className="text-xs text-ai-muted">Loading workspaces…</span>
													) : activeSlackWorkspaces.length > 0 ? (
														<select
															value={slackTeamId}
															onChange={(e) => {
																setSlackTeamId(e.target.value)
																const workspace = activeSlackWorkspaces.find((w) => w.team_id === e.target.value)
																setSlackChannelId(workspace?.default_channel_id ?? '')
															}}
															className={alertSelectClass}
														>
															<option value="" disabled>
																Pick workspace
															</option>
															{activeSlackWorkspaces.map((w) => (
																<option key={w.team_id} value={w.team_id}>
																	{w.team_name}
																</option>
															))}
														</select>
													) : null}
													{slackTeamId ? (
														slackChannelsQuery.isLoading ? (
															<span className="text-xs text-ai-muted">Loading channels…</span>
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
											<p className="text-xs text-ai-warning">
												{readinessBlock.label} →{' '}
												<span className="text-ai-tertiary">
													<SettingsIntegrationsLink />
												</span>
											</p>
										) : null}
									</div>
									<div className="mx-4 h-px bg-ai-hover" />
									<div className="flex items-center justify-between gap-3 px-4 py-2.5">
										<label htmlFor="create-alert-title" className={`shrink-0 ${alertFieldLabelClass}`}>
											Name <span className="font-normal text-ai-muted">(optional)</span>
										</label>
										<input
											id="create-alert-title"
											name="title"
											placeholder={derivedTitle}
											className={`${alertInputClass} max-w-64`}
										/>
									</div>
								</div>

								{onJustAsk ? (
									<button
										type="button"
										onClick={handleJustAsk}
										className="flex items-center gap-1.5 self-start text-xs text-ai-tertiary transition-colors hover:text-link"
									>
										<Icon name="chat" className="size-3.5" />
										{triggerType === 'price'
											? 'Beyond a fixed level? % moves, TVL drops, conditions — ask in chat'
											: 'Want conditions or a multi-token watchlist? Ask in chat'}
									</button>
								) : null}

								{otherErrorMessage ? <p className="text-xs text-ai-error-vivid">{otherErrorMessage}</p> : null}
							</div>

							<div className="flex shrink-0 items-center justify-between gap-3 border-t border-ai-line-subtle px-5 py-3.5">
								{submitBlockReason ? (
									<p className="m-0 min-w-0 truncate text-xs text-ai-muted">{submitBlockReason}</p>
								) : (
									<p className="m-0 flex min-w-0 items-center gap-2 text-xs">
										<Icon
											name={triggerType === 'price' ? 'trending-up' : 'calendar'}
											className="size-3.5 shrink-0 text-ai-muted"
										/>
										<span className="truncate font-mono text-ai-tertiary">
											{triggerSummary} → {channelSummary}
										</span>
									</p>
								)}
								<div className="flex shrink-0 items-center gap-2">
									<button type="button" onClick={() => dialogStore.hide()} className={alertGhostButtonClass}>
										Cancel
									</button>
									<button
										type="submit"
										disabled={!!submitBlockReason || createAlertMutation.isPending}
										title={submitBlockReason ?? undefined}
										className={alertPrimaryButtonClass}
									>
										{createAlertMutation.isPending ? <LoadingSpinner size={14} /> : null}
										Create alert
									</button>
								</div>
							</div>
						</form>
					)}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
})
