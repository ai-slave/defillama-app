import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
	resolveSlackTarget,
	isAlertCapReachedError,
	roundPriceValue,
	type PriceOp,
	type SlackTarget,
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
	alertFieldLabelClass,
	alertSelectClass,
	AlertsHeaderIcon,
	PriceInput,
	PRICE_OPERATOR_OPTIONS,
	DELIVERY_OPTIONS,
	SegmentedToggle,
	SettingsIntegrationsLink
} from '~/containers/LlamaAI/components/alerts/ui'
import { RetryNotice } from '~/containers/LlamaAI/components/RetryNotice'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { SESSIONS_QUERY_KEY, useSessionList } from '~/containers/LlamaAI/hooks/useSessionList'
import { useSlackChannels } from '~/containers/LlamaAI/hooks/useSlackChannels'
import { useSlackWorkspaces } from '~/containers/LlamaAI/hooks/useSlackIntegrationLink'
import { useTokenSearch } from '~/containers/ProDashboard/components/datasets/TokenUsageDataset/useTokenSearch'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, textareaStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface CreateAlertModalProps {
	dialogStore: Ariakit.DialogStore
	initialTab?: TriggerType
	prefill?: { token_nk: string; symbol: string; value: number; op?: PriceOp; currentPrice?: number }
	onJustAsk?: (exampleText: string) => void
}

type CreateAlertBody = ReturnType<typeof buildCreateAlertBody>
type CreateAlertMutation = UseMutationResult<
	{ id: string; alertExpression: string; nextRunAt: string },
	Error,
	CreateAlertBody
>

function AlertTypeCard({
	active,
	value,
	icon,
	title,
	description
}: {
	active: boolean
	value: TriggerType
	icon: 'calendar' | 'trending-up'
	title: string
	description: string
}) {
	const id = useId()
	return (
		<label
			htmlFor={id}
			className={`relative flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-left has-focus-visible:focus-ring ${
				active
					? 'border-brand bg-brand-muted'
					: 'border-medium not-disabled:not-aria-disabled:hover:border-strong not-disabled:not-aria-disabled:hover:bg-hover-row'
			}`}
		>
			<Ariakit.Radio id={id} value={value} aria-label={title} aria-description={description} className="sr-only" />
			<span
				className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
					active ? 'bg-brand-muted text-link-on-tint' : 'bg-page text-secondary'
				}`}
			>
				<Icon name={icon} className="size-3.5" />
			</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className={`label-md ${active ? 'text-link-on-tint' : 'text-primary'}`}>{title}</span>
				<span className="body-sm text-secondary">{description}</span>
			</span>
		</label>
	)
}

function TokenOptionRow({ innerProps, label, data }: any) {
	return (
		<div {...innerProps} className="flex cursor-pointer items-center gap-2 p-2">
			{data.logo ? (
				<img src={data.logo} alt="" width={18} height={18} className="size-[18px] rounded-full" />
			) : (
				<div className="size-[18px] rounded-full bg-surface-elevated-2" />
			)}
			<span className="text-sm">{label}</span>
			{typeof data.price === 'number' ? (
				<span className="ml-auto pl-3 font-mono text-xs text-tertiary">{formatPriceLabel(data.price)}</span>
			) : null}
		</div>
	)
}

// Each opening starts fresh: a new create request, and a form with its defaults. A closing dialog keeps its
// last step on screen through the fade-out.
export function CreateAlertModal(props: CreateAlertModalProps) {
	const open = Ariakit.useStoreState(props.dialogStore, 'open')
	return (
		<Ariakit.DialogProvider store={props.dialogStore}>
			<CreateAlertDialog key={useOpeningKey(open)} {...props} />
		</Ariakit.DialogProvider>
	)
}

function CreateAlertDialog(props: CreateAlertModalProps) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const initialPromptRef = useRef<HTMLTextAreaElement>(null)
	const createAlertMutation: CreateAlertMutation = useMutation({
		mutationFn: async (body: CreateAlertBody) => {
			if (!authorizedFetch) throw new Error('Not authenticated')
			return await createManualAlert(authorizedFetch, body)
		},
		// The alert exists whatever happened to the dialog, so the cache belongs here.
		onSuccess: (_data, variables) => {
			trackUmamiEvent('llamaai-alert-created', { type: variables.trigger.type, source: 'form' })
			void queryClient.invalidateQueries({ queryKey: [ALERTS_QUERY_KEY] })
			void queryClient.invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })
		}
	})
	return (
		// The form mounts only while the dialog is open, so its token search and integration queries do too.
		<Dialog
			size="md"
			fullSheet
			pending={createAlertMutation.isPending}
			initialFocus={initialPromptRef}
			portal
			unmountOnHide
		>
			<CreateAlertModalForm {...props} mutation={createAlertMutation} initialPromptRef={initialPromptRef} />
		</Dialog>
	)
}

function CreateAlertModalForm({
	dialogStore,
	initialTab,
	prefill,
	onJustAsk,
	mutation: createAlertMutation,
	initialPromptRef
}: CreateAlertModalProps & {
	mutation: CreateAlertMutation
	initialPromptRef: React.RefObject<HTMLTextAreaElement | null>
}) {
	const router = useRouter()
	const { alertsUsage } = useSessionList()
	const fieldId = useId()
	const tokenInputId = `${fieldId}-token`
	const promptId = `${fieldId}-prompt`
	const titleId = `${fieldId}-title`
	const summaryId = `${fieldId}-summary`

	const openTab: TriggerType = initialTab ?? (prefill ? 'price' : 'schedule')
	const [triggerType, setTriggerType] = useState<TriggerType>(openTab)
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
	const [pickedSlack, setPickedSlack] = useState<SlackTarget | null>(null)
	// A retried channel list focuses the select that replaces the retry button, so focus never drops to the page.
	const focusChannelsOnLoadRef = useRef(false)

	const { data: tokenOptionsResponse, isLoading: isLoadingTokens } = useTokenSearch(tokenSearchInput, true)
	const tokenOptions = tokenOptionsResponse ?? []

	const telegramLink = useIntegrationLink()
	const telegramLinked = telegramLink.state.status === 'linked'

	const slackWorkspacesQuery = useSlackWorkspaces()
	const activeSlackWorkspaces = useMemo(() => {
		const workspaces = slackWorkspacesQuery.data?.workspaces ?? []
		return workspaces.filter((w) => !w.revoked)
	}, [slackWorkspacesQuery.data?.workspaces])
	const { teamId: slackTeamId, channelId: slackChannelId } = resolveSlackTarget({
		isSlack: deliveryChannel === 'slack',
		picked: pickedSlack,
		workspaces: activeSlackWorkspaces
	})
	const slackChannelsQuery = useSlackChannels(deliveryChannel === 'slack' && slackTeamId ? slackTeamId : null)
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

	// This component only exists while the dialog is open, so mounting is the open. Reporting the tab the
	// dialog opened on keeps this off the live triggerType, which a later switch would re-report.
	useEffect(() => {
		trackUmamiEvent('llamaai-alert-create-open', { tab: openTab })
	}, [openTab])

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

	const isPending = createAlertMutation.isPending
	const isUpsell = alertsUsage?.allowed === false || isAlertCapReachedError(createAlertMutation.error)

	const derivedTitle = deriveAlertTitle({
		triggerType,
		prompt,
		symbol: priceToken?.symbol ?? null,
		op: priceOp,
		value: priceValue
	})

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (submitBlockReason || isPending) return
		// The fields lock while creating; the footer's submit, outside them, holds focus and its "Creating…" label.
		;(e.nativeEvent as SubmitEvent).submitter?.focus()
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

	if (createAlertMutation.isSuccess) {
		return (
			<>
				<DialogHeader title="Alert created" leading={<AlertsHeaderIcon />} />
				<DialogBody>
					<p id={summaryId} className="body-sm text-secondary">
						{triggerSummary}, delivered to {deliveryChannel === 'email' ? 'your email' : channelSummary}.
					</p>
				</DialogBody>
				<DialogFooter>
					<Button
						type="button"
						variant="primary"
						size="md"
						autoFocus
						aria-describedby={summaryId}
						onClick={() => dialogStore.hide()}
					>
						Done
					</Button>
				</DialogFooter>
			</>
		)
	}

	if (isUpsell) {
		return (
			<>
				<DialogHeader title="Alert limit reached" leading={<AlertsHeaderIcon />} />
				<DialogBody>
					<p className="body-sm text-secondary">
						{getUpsellCopy(alertsUsage ?? null)}. Upgrade to Pro to create more alerts.
					</p>
				</DialogBody>
				<DialogFooter
					dismiss={
						<Button type="button" size="md" onClick={() => dialogStore.hide()}>
							Maybe later
						</Button>
					}
				>
					<Button
						// A server cap swaps the form, and the Create button with it, for this step. React's autoFocus skips links.
						ref={takeLostFocus}
						as={BasicLink}
						variant="primary"
						size="md"
						href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
						onClick={() => {
							setSignupSource('alert-limit')
							trackUmamiEvent('llamaai-alert-upsell', { action: 'upgrade' })
							dialogStore.hide()
						}}
					>
						Upgrade to Pro
					</Button>
				</DialogFooter>
			</>
		)
	}

	return (
		<form onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
			<DialogHeader title="New alert" subtitle="Get pinged when things move" leading={<AlertsHeaderIcon />} />
			<DialogBody>
				{/* Locked while the create runs, so the outcome step describes the alert that was sent. */}
				<fieldset disabled={isPending} className="contents">
					<Ariakit.RadioProvider
						value={triggerType}
						setValue={(value) => {
							if (value === 'schedule' || value === 'price') setTriggerType(value)
						}}
					>
						<Ariakit.RadioGroup aria-label="Alert type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<AlertTypeCard
								active={triggerType === 'schedule'}
								value="schedule"
								icon="calendar"
								title="Scheduled report"
								description="Answers a question of yours every day or week"
							/>
							<AlertTypeCard
								active={triggerType === 'price'}
								value="price"
								icon="trending-up"
								title="Price alert"
								description="Instant ping when a token crosses your level"
							/>
						</Ariakit.RadioGroup>
					</Ariakit.RadioProvider>

					{triggerType === 'schedule' ? (
						<div className="flex flex-col gap-1.5">
							<label htmlFor={promptId} className={alertFieldLabelClass}>
								What should it tell you?
							</label>
							<textarea
								id={promptId}
								ref={initialPromptRef}
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								rows={2}
								placeholder="Hyperliquid TVL and its top drivers"
								className={`${textareaStyles} w-full resize-none`}
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
										className="touch-target rounded-full border border-medium px-2.5 py-1 text-xs text-tertiary not-disabled:not-aria-disabled:hover:border-strong not-disabled:not-aria-disabled:hover:text-primary data-[active=true]:border-link/40 data-[active=true]:bg-link/6 data-[active=true]:text-link"
									>
										{suggestion.label}
									</button>
								))}
							</div>
						</div>
					) : (
						<>
							<div className="flex flex-col gap-1.5">
								<label htmlFor={tokenInputId} className={alertFieldLabelClass}>
									Token
								</label>
								<ReactSelect
									inputId={tokenInputId}
									placeholder="Search tokens…"
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
									// A disabled fieldset reaches only native controls; the picker locks through its own prop.
									isDisabled={isPending}
									isClearable
									components={{ Option: TokenOptionRow }}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<span className={alertFieldLabelClass}>Fires when the price goes</span>
								<div className="flex flex-wrap items-center gap-2">
									<SegmentedToggle<PriceOp>
										label="Price comparison"
										value={priceOp}
										onChange={setPriceOp}
										options={PRICE_OPERATOR_OPTIONS}
									/>
									<PriceInput value={priceValue} onValueChange={setPriceValue} />
								</div>
								{currentPrice ? (
									<button
										type="button"
										onClick={() => setPriceValue(roundPriceValue(currentPrice))}
										className="self-start text-left body-sm text-secondary not-disabled:not-aria-disabled:hover:text-link"
									>
										{priceToken.symbol.toUpperCase()} is trading around{' '}
										<span className="font-mono text-primary">{formatPriceLabel(currentPrice)}</span> — tap to use
									</button>
								) : (
									<p className="body-sm text-secondary">
										Fires once, then pauses — re-arm it anytime from your alerts.
									</p>
								)}
							</div>
						</>
					)}

					{triggerType === 'schedule' ? (
						<div className="flex flex-col gap-1.5">
							<span className={alertFieldLabelClass}>When should it arrive?</span>
							<div className="flex flex-wrap items-center gap-2">
								<select
									value={frequency}
									aria-label="Frequency"
									onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
									className={alertSelectClass}
								>
									<option value="daily">Daily</option>
									<option value="weekly">Weekly</option>
								</select>
								{frequency === 'weekly' ? (
									<select
										value={dayOfWeek}
										aria-label="Day of week"
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
								<span className="body-sm text-secondary">at</span>
								<select
									value={hour}
									aria-label="Hour"
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
									aria-label="Timezone"
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
						<div className="flex flex-col gap-1.5">
							<label htmlFor={promptId} className={alertFieldLabelClass}>
								Add context to the ping (optional)
							</label>
							<textarea
								id={promptId}
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								rows={1}
								placeholder="ETH price, gas, and what moved the market"
								className={`${textareaStyles} w-full resize-none`}
							/>
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
							{deliveryChannel === 'slack' ? (
								<>
									{slackWorkspacesQuery.isLoading ? (
										<span className="body-sm text-tertiary">Loading workspaces…</span>
									) : activeSlackWorkspaces.length > 0 ? (
										<select
											value={slackTeamId}
											aria-label="Slack workspace"
											onChange={(e) => {
												const workspace = activeSlackWorkspaces.find((w) => w.team_id === e.target.value)
												setPickedSlack({
													teamId: e.target.value,
													channelId: workspace?.default_channel_id ?? ''
												})
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
											<span className="body-sm text-tertiary">Loading channels…</span>
										) : slackChannelsQuery.isError ? (
											<RetryNotice
												message="Couldn't load Slack channels."
												retrying={slackChannelsQuery.isFetching}
												onRetry={() => {
													focusChannelsOnLoadRef.current = true
													void slackChannelsQuery.refetch()
												}}
											/>
										) : (
											<select
												ref={(select) => {
													if (!select || !focusChannelsOnLoadRef.current) return
													focusChannelsOnLoadRef.current = false
													select.focus()
												}}
												value={slackChannelId}
												aria-label="Slack channel"
												// The workspace travels with the channel, so a later workspace change cannot inherit it.
												onChange={(e) => setPickedSlack({ teamId: slackTeamId, channelId: e.target.value })}
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
							<p className="body-sm text-warning">
								{readinessBlock.label} in{' '}
								<span className="text-secondary">
									<SettingsIntegrationsLink />
								</span>
							</p>
						) : null}
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor={titleId} className={alertFieldLabelClass}>
							Name (optional)
						</label>
						<Input id={titleId} name="title" placeholder={derivedTitle} className="w-full" />
					</div>

					{onJustAsk ? (
						<button
							type="button"
							onClick={handleJustAsk}
							className="flex items-center gap-1.5 self-start text-left body-sm text-secondary not-disabled:not-aria-disabled:hover:text-link"
						>
							<Icon name="chat" className="size-3.5 shrink-0" />
							{triggerType === 'price'
								? 'Beyond a fixed level? % moves, TVL drops, conditions — ask in chat'
								: 'Want conditions or a multi-token watchlist? Ask in chat'}
						</button>
					) : null}
				</fieldset>
				{createAlertMutation.isError ? (
					<InlineStatus variant="error">Couldn't create the alert. Try again.</InlineStatus>
				) : null}
			</DialogBody>

			<DialogFooter
				leading={
					<p className="min-w-0 truncate body-sm text-secondary">
						{submitBlockReason ?? `${triggerSummary} → ${channelSummary}`}
					</p>
				}
				dismiss={
					<Button type="button" size="md" disabled={isPending} onClick={() => dialogStore.hide()}>
						Cancel
					</Button>
				}
			>
				<Button
					type="submit"
					variant="primary"
					size="md"
					disabled={!!submitBlockReason}
					pendingLabel={isPending ? 'Creating…' : null}
				>
					Create alert
				</Button>
			</DialogFooter>
			<span role="status" className="sr-only">
				{isPending ? 'Creating alert…' : ''}
			</span>
		</form>
	)
}
