import * as Ariakit from '@ariakit/react'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { BasicLink } from '~/components/Link'
import { VirtualizedSelect, type VirtualizedSelectOption } from '~/components/Select/VirtualizedSelect'
import {
	type AlertSchedule,
	AlertScheduleFields,
	SlackTargetPickers
} from '~/containers/LlamaAI/components/alerts/AlertScheduleFields'
import { createManualAlert } from '~/containers/LlamaAI/components/alerts/api'
import {
	ALERT_PROMPT_SUGGESTIONS,
	buildCreateAlertBody,
	buildJustAskExample,
	buildScheduleExpressionRaw,
	deriveAlertTitle,
	formatPriceLabel,
	getDeliveryError,
	getDeliveryReadinessBlock,
	getPriceCaption,
	getSlackListGate,
	getUpsellCopy,
	isAlertCapReachedError,
	type PriceOp,
	resolveSlackTarget,
	roundPriceValue,
	type SlackTarget,
	type TriggerType,
	validatePrice,
	validatePrompt
} from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { ALERTS_QUERY_KEY } from '~/containers/LlamaAI/components/alerts/queryKeys'
import { formatScheduleExpression, getUserTimezone } from '~/containers/LlamaAI/components/alerts/schedule'
import type { DeliveryChannel } from '~/containers/LlamaAI/components/alerts/types'
import {
	AlertsHeaderIcon,
	PriceInput,
	PRICE_OPERATOR_OPTIONS,
	DELIVERY_OPTIONS,
	SegmentedToggle,
	SettingsIntegrationsLink
} from '~/containers/LlamaAI/components/alerts/ui'
import { useIntegrationLink } from '~/containers/LlamaAI/hooks/useIntegrationLink'
import { SESSIONS_QUERY_KEY, useSessionList } from '~/containers/LlamaAI/hooks/useSessionList'
import { useSlackChannels } from '~/containers/LlamaAI/hooks/useSlackChannels'
import { useSlackWorkspaces } from '~/containers/LlamaAI/hooks/useSlackIntegrationLink'
import {
	type TokenOption,
	useTokenSearch
} from '~/containers/ProDashboard/components/datasets/TokenUsageDataset/useTokenSearch'
import { Button } from '~/ui/Button'
import {
	Dialog,
	DialogBody,
	DialogCancelButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	useOpeningKey
} from '~/ui/Dialog'
import { Field, FieldGroup } from '~/ui/Field'
import { showFieldErrors, takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { queryReadFailed } from '~/utils/query'

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
					active ? 'bg-brand-muted text-link' : 'bg-page text-secondary'
				}`}
			>
				<Icon name={icon} className="size-3.5" />
			</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className={`label-md ${active ? 'text-link' : 'text-primary'}`}>{title}</span>
				<span className="body-sm text-secondary">{description}</span>
			</span>
		</label>
	)
}

const EMPTY_TOKEN_OPTIONS: Array<TokenOption> = []

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
		mutationFn: (body: CreateAlertBody) => createManualAlert(authorizedFetch, body),
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
	const summaryId = `${fieldId}-summary`

	const openTab: TriggerType = initialTab ?? (prefill ? 'price' : 'schedule')
	const [triggerType, setTriggerType] = useState<TriggerType>(openTab)
	const [prompt, setPrompt] = useState('')

	const [schedule, setSchedule] = useState<AlertSchedule>(() => ({
		frequency: 'daily',
		hour: 9,
		dayOfWeek: 1,
		timezone: getUserTimezone()
	}))

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
	const [title, setTitle] = useState('')
	// Typed text is the work closing would drop; a prefilled price level is not.
	const hasTypedWork =
		prompt.trim() !== '' || title.trim() !== '' || priceValue !== (prefill ? roundPriceValue(prefill.value) : '')

	const { data: tokenOptionsResponse, isPlaceholderData: isSearchingTokens } = useTokenSearch(tokenSearchInput, true)
	const tokenOptions = tokenOptionsResponse ?? EMPTY_TOKEN_OPTIONS
	const tokenSelectOptions = useMemo(() => {
		const options: Array<VirtualizedSelectOption> = []
		// The picked token stays listed through a new search, so the field keeps showing its name.
		if (priceToken && !tokenOptions.some((token) => token.value === priceToken.symbol)) {
			options.push({ value: priceToken.symbol, label: priceToken.symbol.toUpperCase() })
		}
		for (const token of tokenOptions) {
			options.push({
				value: token.value,
				label: token.label,
				logo: token.logo,
				...(typeof token.price === 'number' ? { description: formatPriceLabel(token.price) } : {})
			})
		}
		return options
	}, [tokenOptions, priceToken])

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

	const [submitted, setSubmitted] = useState(false)
	const errors = {
		prompt: validatePrompt(triggerType, prompt),
		token: triggerType === 'price' && !priceToken ? 'Choose a token.' : null,
		price: triggerType === 'price' ? validatePrice(priceValue) : null,
		delivery: getDeliveryError({
			channel: deliveryChannel,
			telegramLinked,
			slackTeamId,
			slackChannelId,
			slackWorkspaceCount: activeSlackWorkspaces.length
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
		if (isPending || slackGate) return
		if (errors.prompt || errors.token || errors.price || errors.delivery) {
			return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		}
		// The fields lock while creating; the footer's submit, outside them, holds focus and its "Creating…" label.
		;(e.nativeEvent as SubmitEvent).submitter?.focus()
		const slackChannelName = slackChannels?.find((c) => c.id === slackChannelId)?.name ?? null
		const body = buildCreateAlertBody({
			title: title.trim() || derivedTitle,
			triggerType,
			prompt,
			schedule,
			price: { tokenNk: priceToken?.tokenNk ?? '', value: priceValue, op: priceOp },
			delivery: { channel: deliveryChannel, slackTeamId, slackChannelId, slackChannelName }
		})
		createAlertMutation.mutate(body)
	}

	const handleJustAsk = () => {
		const example = buildJustAskExample({
			triggerType,
			frequency: schedule.frequency,
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
			? `Runs ${formatScheduleExpression(buildScheduleExpressionRaw(schedule))}`
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
		<form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-auto flex-col">
			<DialogHeader title="New alert" subtitle="Get pinged when things move" leading={<AlertsHeaderIcon />} />
			<DialogDiscardGuard
				when={hasTypedWork}
				title="Discard this alert?"
				description="The alert you started is not created."
			/>
			<DialogBody>
				{/* Locked while the create runs, so the outcome step describes the alert that was sent. */}
				<fieldset disabled={isPending} className="contents">
					<Ariakit.RadioProvider
						value={triggerType}
						setValue={(value) => {
							if (value !== 'schedule' && value !== 'price') return
							// The other type asks different questions; its untouched fields stay quiet until the next submit.
							if (value !== triggerType) setSubmitted(false)
							setTriggerType(value)
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
							<Field label="What should it tell you?" error={shown?.prompt}>
								{(control) => (
									<Textarea
										{...control}
										ref={initialPromptRef}
										required
										value={prompt}
										onChange={(e) => setPrompt(e.target.value)}
										rows={2}
										placeholder="Hyperliquid TVL and its top drivers"
										className="w-full resize-none"
									/>
								)}
							</Field>
							<div className="flex flex-wrap gap-1.5">
								{ALERT_PROMPT_SUGGESTIONS.map((suggestion) => (
									<Button
										key={suggestion.label}
										variant="secondary"
										size="sm"
										onClick={() => {
											setPrompt(suggestion.prompt)
											trackUmamiEvent('llamaai-alert-suggestion', { label: suggestion.label })
										}}
									>
										{suggestion.label}
									</Button>
								))}
							</div>
						</div>
					) : (
						<>
							<VirtualizedSelect
								variant="field"
								label="Token"
								options={tokenSelectOptions}
								selectedValue={priceToken?.symbol ?? null}
								onChange={(option) => {
									const token = tokenOptions.find((candidate) => candidate.value === option.value)
									if (!token) return
									setPriceToken({
										tokenNk: `coingecko:${token.id}`,
										symbol: token.value,
										currentPrice: typeof token.price === 'number' ? token.price : null
									})
								}}
								onSearchChange={setTokenSearchInput}
								isSearching={isSearchingTokens}
								placeholder="Select token…"
								error={shown?.token}
							/>
							<div className="flex flex-col gap-1.5">
								<Field label="Fires when the price goes" error={shown?.price}>
									{(control) => (
										<div className="flex flex-wrap items-center gap-2">
											<SegmentedToggle<PriceOp>
												label="Price comparison"
												value={priceOp}
												onChange={setPriceOp}
												options={PRICE_OPERATOR_OPTIONS}
											/>
											<PriceInput value={priceValue} onValueChange={setPriceValue} control={control} />
										</div>
									)}
								</Field>
								{currentPrice ? (
									<button
										type="button"
										onClick={() => setPriceValue(roundPriceValue(currentPrice))}
										className="self-start text-left body-sm text-secondary not-disabled:not-aria-disabled:hover:text-link"
									>
										{priceToken.symbol.toUpperCase()} is trading around{' '}
										<span className="text-primary">{formatPriceLabel(currentPrice)}</span> — tap to use
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
						<AlertScheduleFields label="When should it arrive?" schedule={schedule} onChange={setSchedule} />
					) : (
						<Field label="Add context to the ping (optional)">
							{(control) => (
								<Textarea
									{...control}
									value={prompt}
									onChange={(e) => setPrompt(e.target.value)}
									rows={1}
									placeholder="ETH price, gas, and what moved the market"
									className="w-full resize-none"
								/>
							)}
						</Field>
					)}

					<FieldGroup
						label="Where should it go?"
						hint={
							readinessBlock ? (
								<span className="text-warning">
									{readinessBlock.label} in{' '}
									<span className="text-secondary">
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
							{deliveryChannel === 'slack' ? (
								<SlackTargetPickers
									workspaces={activeSlackWorkspaces}
									workspacesLoading={slackWorkspacesQuery.isLoading}
									target={{ teamId: slackTeamId, channelId: slackChannelId }}
									channelsQuery={slackChannelsQuery}
									invalid={!!shown?.delivery}
									onPick={setPickedSlack}
								/>
							) : null}
						</div>
					</FieldGroup>

					<Field label="Name (optional)">
						{(control) => (
							<Input
								{...control}
								name="title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder={derivedTitle}
								className="w-full"
							/>
						)}
					</Field>

					{onJustAsk ? (
						<button
							type="button"
							onClick={handleJustAsk}
							className="flex items-center gap-1.5 self-start text-left body-sm text-secondary not-disabled:not-aria-disabled:hover:text-link"
						>
							<Icon name="message-square" className="size-3.5 shrink-0" />
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
				leading={<p className="min-w-0 truncate body-sm text-secondary">{`${triggerSummary} → ${channelSummary}`}</p>}
				dismiss={<DialogCancelButton />}
			>
				{/* A failed channel list holds Create; its notice and Try again sit in the delivery field. */}
				<Button
					type="submit"
					variant="primary"
					size="md"
					disabled={slackGate === 'channelsFailed'}
					accessibleWhenDisabled
					// The Slack channel list gates the submit: it waits with the list's own label while that loads.
					pendingLabel={isPending || slackGate === null || slackGate === 'channelsFailed' ? 'Creating…' : slackGate}
					pending={isPending || (slackGate !== null && slackGate !== 'channelsFailed')}
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
