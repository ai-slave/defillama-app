import * as Ariakit from '@ariakit/react'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { BasicLink } from '~/components/Link'
import type { MemoryEntry } from '~/containers/LlamaAI/api/agentHome'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { getIntegrationRowResetKey, IntegrationRow } from '~/containers/LlamaAI/components/IntegrationRow'
import { SlackIntegrationRow } from '~/containers/LlamaAI/components/SlackIntegrationRow'
import { useAgentHomeData } from '~/containers/LlamaAI/hooks/useAgentHomeData'
import type {
	EffortOption,
	LlamaAISettings,
	LlamaAISettingsActions,
	ModelOption
} from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import {
	notifyNotificationPermissionChanged,
	useNotificationPermission
} from '~/containers/LlamaAI/hooks/useNotificationPermission'
import {
	isWebMobileToggleVisible,
	type WebMobilePreference,
	type WebMobilePushEnabledMutation
} from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'
import {
	isSettingsTabId,
	type SettingsInitialState,
	type SettingsTabId
} from '~/containers/LlamaAI/utils/settingsIntent'
import { useDarkModeManager, useLlamaAINotifyBannerDismissed } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles, textareaStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { Skeleton } from '~/ui/Skeleton'
import { LoadingIndicator } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { Tabs, Tab, TabPanel } from '~/ui/Tabs'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatFixedNumber } from '~/utils/numberFormat'
import { BalanceSettings } from './BalanceSettings'
import { RetryNotice } from './RetryNotice'

const MAX_LENGTH = 5000

type TabId = SettingsTabId

function isEffortAvailableForModel(effort: string, model: string) {
	const isClaude = model === '' || model.startsWith('anthropic/')
	if (isClaude) return effort !== 'minimal'
	if (model.startsWith('openai/')) return effort !== 'max'
	return true
}

interface SettingsModalProps {
	dialogStore: Ariakit.DialogStore
	settings: LlamaAISettings
	actions: LlamaAISettingsActions
	availableModels?: Array<ModelOption>
	availableEfforts?: Array<EffortOption>
	telegramStatus?: TelegramStatus | null
	isSettingsLoading?: boolean
	initialState?: SettingsInitialState | null
	onInitialStateConsumed?: () => void
	mobileNotificationPreference?: WebMobilePreference
	setMobileNotificationEnabled?: WebMobilePushEnabledMutation
}

export const SettingsModal = memo(function SettingsModal({
	dialogStore,
	settings,
	actions,
	availableModels,
	availableEfforts,
	telegramStatus,
	isSettingsLoading,
	initialState,
	onInitialStateConsumed,
	mobileNotificationPreference,
	setMobileNotificationEnabled
}: SettingsModalProps) {
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')
	const [isDark] = useDarkModeManager()
	const [, markNotifBannerDismissed] = useLlamaAINotifyBannerDismissed()
	const notifPermission = useNotificationPermission()
	const [isRequestingNotif, setIsRequestingNotif] = useState(false)
	const [selectedTab, setSelectedTab] = useState<TabId>(() =>
		isSettingsTabId(initialState?.tab) ? initialState.tab : 'persona'
	)
	// Which command object the tab above came from. Applying a new one during render keeps the modal
	// from opening on the old tab for a frame, and identity is what marks it applied -- the parent
	// hands over a fresh object each time it asks for a tab.
	const [appliedInitialState, setAppliedInitialState] = useState(initialState)
	if (isOpen && initialState && initialState !== appliedInitialState) {
		setAppliedInitialState(initialState)
		if (isSettingsTabId(initialState?.tab)) setSelectedTab(initialState.tab)
	}
	// The lab tab renders only in dark mode, so light mode falls back rather than leaving the panel
	// blank. Constraining the selection here keeps one source of truth for which tab is showing.
	const activeTab: TabId = selectedTab === 'lab' && !isDark ? 'persona' : selectedTab
	const agentHome = useAgentHomeData(isOpen && activeTab === 'memory')
	const initialInstructions = settings.customInstructions
	const [instructionsDraft, setInstructionsDraft] = useState(() => ({
		value: initialInstructions,
		savedValue: initialInstructions.trim()
	}))
	const acceptedInstructionsRef = useRef(initialInstructions.trim())
	const lastSubmittedInstructionsRef = useRef(initialInstructions.trim())
	const pendingInstructionsSavesRef = useRef(0)
	const instructionsDirty = instructionsDraft.value.trim() !== instructionsDraft.savedValue

	useEffect(() => {
		if (!isOpen) return
		if (initialState && !initialState.tgloginToken && onInitialStateConsumed) onInitialStateConsumed()
	}, [isOpen, initialState, onInitialStateConsumed])

	// Value passed in rather than defaulted from the draft: a member expression in a default parameter is
	// one the compiler cannot reorder.
	const commitDraft = async (value: string) => {
		const nextValue = value.trim()
		if (nextValue === lastSubmittedInstructionsRef.current) return

		lastSubmittedInstructionsRef.current = nextValue
		pendingInstructionsSavesRef.current += 1
		trackUmamiEvent('llamaai-custom-instructions-save')
		const accepted = await actions.setCustomInstructions(nextValue).catch(() => false)
		pendingInstructionsSavesRef.current -= 1
		if (accepted) {
			acceptedInstructionsRef.current = nextValue
			setInstructionsDraft((current) => ({ ...current, savedValue: nextValue }))
		} else if (lastSubmittedInstructionsRef.current === nextValue) {
			lastSubmittedInstructionsRef.current = acceptedInstructionsRef.current
		}
	}

	useEffect(() => {
		const nextValue = settings.customInstructions
		const nextSavedValue = nextValue.trim()
		const previousAcceptedValue = acceptedInstructionsRef.current
		acceptedInstructionsRef.current = nextSavedValue
		if (pendingInstructionsSavesRef.current === 0 && lastSubmittedInstructionsRef.current === previousAcceptedValue) {
			lastSubmittedInstructionsRef.current = nextSavedValue
		}
		setInstructionsDraft((current) => {
			if (current.savedValue === nextSavedValue) return current
			const wasDirty = current.value.trim() !== current.savedValue
			const preserveDraft = wasDirty || pendingInstructionsSavesRef.current > 0
			return { value: preserveDraft ? current.value : nextValue, savedValue: nextSavedValue }
		})
	}, [settings.customInstructions])

	useEffect(() => {
		if (isOpen) trackUmamiEvent('llamaai-settings-open')
	}, [isOpen])

	const handleClear = () => {
		setInstructionsDraft((current) => ({ ...current, value: '' }))
		void commitDraft('')
	}

	const handleMemoryToggle = useCallback(() => {
		trackUmamiEvent('llamaai-memory-toggle')
		void actions.setEnableMemory(!settings.enableMemory)
	}, [actions, settings.enableMemory])

	const handlePremiumToolsToggle = useCallback(() => {
		trackUmamiEvent('llamaai-premium-tools-toggle')
		void actions.setEnablePremiumTools(!settings.enablePremiumTools)
	}, [actions, settings.enablePremiumTools])

	const handleHackerToggle = useCallback(() => {
		trackUmamiEvent('llamaai-hacker-mode-toggle')
		void actions.setHackerMode(!settings.hackerMode)
	}, [actions, settings.hackerMode])

	const handleSoundToggle = useCallback(() => {
		trackUmamiEvent('llamaai-sound-notifications-toggle')
		void actions.setEnableSoundNotifications(!settings.enableSoundNotifications)
	}, [actions, settings.enableSoundNotifications])

	const handleMobileNotificationToggle = useCallback(() => {
		if (
			!mobileNotificationPreference ||
			!isWebMobileToggleVisible(mobileNotificationPreference) ||
			!setMobileNotificationEnabled ||
			setMobileNotificationEnabled.isPending
		)
			return
		trackUmamiEvent('llamaai-mobile-notifications-toggle')
		void setMobileNotificationEnabled.mutateAsync(!mobileNotificationPreference.enabled).catch(() => undefined)
	}, [mobileNotificationPreference, setMobileNotificationEnabled])

	const handleEnterToSendToggle = useCallback(() => {
		trackUmamiEvent('llamaai-enter-to-send-toggle')
		void actions.setEnterToSend(!settings.enterToSend)
	}, [actions, settings.enterToSend])

	const handleAdvancedProvenanceToggle = useCallback(() => {
		trackUmamiEvent('llamaai-advanced-provenance-toggle')
		void actions.setAdvancedProvenance(!settings.advancedProvenance)
	}, [actions, settings.advancedProvenance])

	const handleShowBalanceInSidebarToggle = useCallback(() => {
		trackUmamiEvent('llamaai-sidebar-balance-toggle')
		void actions.setShowBalanceInSidebar(!settings.showBalanceInSidebar)
	}, [actions, settings.showBalanceInSidebar])

	const [spendCapDraft, setSpendCapDraft] = useState<string>(() => formatFixedNumber(settings.spendCapPerMessage, 2))
	const latestSpendCapRef = useRef(settings.spendCapPerMessage)
	const lastSubmittedSpendCapRef = useRef(settings.spendCapPerMessage)
	const pendingSpendCapSavesRef = useRef(0)

	useEffect(() => {
		latestSpendCapRef.current = settings.spendCapPerMessage
		if (pendingSpendCapSavesRef.current > 0 && settings.spendCapPerMessage !== lastSubmittedSpendCapRef.current) return
		lastSubmittedSpendCapRef.current = settings.spendCapPerMessage
		setSpendCapDraft(formatFixedNumber(settings.spendCapPerMessage, 2))
	}, [settings.spendCapPerMessage])

	const commitSpendCap = useCallback(
		(raw: string) => {
			const parsed = Number(raw)
			if (!Number.isFinite(parsed) || parsed < 0) {
				setSpendCapDraft(formatFixedNumber(latestSpendCapRef.current, 2))
				return
			}
			setSpendCapDraft(formatFixedNumber(parsed, 2))
			if (parsed === lastSubmittedSpendCapRef.current) return
			lastSubmittedSpendCapRef.current = parsed
			pendingSpendCapSavesRef.current += 1
			trackUmamiEvent('llamaai-spend-cap-change')
			void actions.setSpendCapPerMessage(parsed).then((accepted) => {
				pendingSpendCapSavesRef.current -= 1
				if (!accepted && lastSubmittedSpendCapRef.current === parsed) {
					lastSubmittedSpendCapRef.current = latestSpendCapRef.current
					setSpendCapDraft(formatFixedNumber(latestSpendCapRef.current, 2))
				}
			})
		},
		[actions]
	)

	const handleSpendCapChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setSpendCapDraft(e.target.value)
	}, [])

	const handleSpendCapBlur = useCallback(
		(e: React.FocusEvent<HTMLInputElement>) => {
			commitSpendCap(e.target.value)
		},
		[commitSpendCap]
	)

	const handleSpendCapKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				e.preventDefault()
				commitSpendCap((e.target as HTMLInputElement).value)
				;(e.target as HTMLInputElement).blur()
			}
		},
		[commitSpendCap]
	)

	const handleNotifToggle = useCallback(() => {
		if (notifPermission !== 'default' || isRequestingNotif) return
		trackUmamiEvent('llamaai-notify-settings-enable')
		setIsRequestingNotif(true)
		Notification.requestPermission()
			.then((next) => {
				notifyNotificationPermissionChanged()
				if (next !== 'granted') markNotifBannerDismissed()
			})
			.catch(() => markNotifBannerDismissed())
			.finally(() => setIsRequestingNotif(false))
	}, [notifPermission, isRequestingNotif, markNotifBannerDismissed])

	const handleModelChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const nextModel = e.target.value
			void actions.setModel(nextModel)
			if (settings.effort && !isEffortAvailableForModel(settings.effort, nextModel)) {
				void actions.setEffort('')
			}
		},
		[actions, settings.effort]
	)

	const handleEffortChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const nextEffort = e.target.value
			if (nextEffort && !isEffortAvailableForModel(nextEffort, settings.model)) return
			void actions.setEffort(nextEffort)
		},
		[actions, settings.model]
	)

	const showClear = instructionsDirty || instructionsDraft.savedValue.length > 0
	const notifSupported = notifPermission !== 'unsupported'

	const tabs: Array<{
		id: TabId
		label: string
		icon: 'pencil' | 'gear-settings' | 'sparkles' | 'flame' | 'link' | 'wallet'
	}> = [
		{ id: 'persona', label: 'Persona', icon: 'pencil' },
		{ id: 'app', label: 'App', icon: 'gear-settings' },
		{ id: 'capabilities', label: 'Capabilities', icon: 'sparkles' },
		{ id: 'integrations', label: 'Integrations', icon: 'link' },
		{ id: 'memory', label: 'Memory', icon: 'sparkles' },
		{ id: 'balance', label: 'Balance', icon: 'wallet' }
	]
	if (isDark) tabs.push({ id: 'lab', label: 'Lab', icon: 'flame' })

	let mobileNotificationRow: React.ReactNode = null
	if (mobileNotificationPreference) {
		switch (mobileNotificationPreference.kind) {
			case 'signed-out':
				break
			case 'loading':
				mobileNotificationRow = (
					<>
						<RowDivider />
						<div role="status" className="flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left">
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<p className="m-0 label-md text-primary">Mobile notifications</p>
								<p className="m-0 body-sm text-secondary">Loading your mobile notification preference…</p>
							</div>
							<LoadingSpinner size={16} />
						</div>
					</>
				)
				break
			case 'error':
				mobileNotificationRow = (
					<>
						<RowDivider />
						<div role="alert" className="flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left">
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<p className="m-0 label-md text-primary">Mobile notifications</p>
								<p className="m-0 body-sm text-secondary">
									Couldn't load mobile notifications. {mobileNotificationPreference.message}
								</p>
							</div>
							<Button type="button" size="sm" onClick={mobileNotificationPreference.retry}>
								Try again
							</Button>
						</div>
					</>
				)
				break
			case 'known':
				if (!mobileNotificationPreference.available) break
				mobileNotificationRow = (
					<>
						<RowDivider />
						<ToggleRow
							label="Mobile notifications"
							description={
								setMobileNotificationEnabled?.error
									? "Couldn't update mobile notifications. Try again."
									: setMobileNotificationEnabled?.isPending
										? 'Updating your mobile notification preference…'
										: mobileNotificationPreference.enabled
											? 'Notify your phone when you leave a web chat before LlamaAI finishes.'
											: 'Get notified on your phone when a web response finishes after you leave.'
							}
							checked={mobileNotificationPreference.enabled}
							onClick={handleMobileNotificationToggle}
							interactive={!!setMobileNotificationEnabled && !setMobileNotificationEnabled.isPending}
						/>
					</>
				)
				break
			default: {
				const _exhaustive: never = mobileNotificationPreference
				void _exhaustive
			}
		}
	}

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				onClose={() => {
					setAppliedInitialState(null)
					void commitDraft(instructionsDraft.value)
				}}
				className={`${dialogSurfaceStyles} [--dialog-width:720px]`}
				portal
				unmountOnHide
			>
				<header className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<div className="flex flex-col gap-0.5">
						<DialogHeading>Settings</DialogHeading>
						<p className="m-0 body-sm text-secondary">Tune how LlamaAI works for you</p>
					</div>
					<DialogCloseButton className="-mr-1" ariaLabel="Close settings" />
				</header>

				<Tabs<TabId>
					value={activeTab}
					onValueChange={setSelectedTab}
					values={tabs.map((tab) => tab.id)}
					orientation="both"
				>
					<div className="flex min-h-0 flex-auto flex-col sm:min-h-[480px] sm:flex-row">
						<Ariakit.TabList
							aria-label="Settings sections"
							className="flex shrink-0 gap-1 overflow-x-auto border-b border-subtle p-2 sm:w-[180px] sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-r sm:border-b-0 sm:bg-page sm:p-3"
						>
							{tabs.map((tab) => {
								const isActive = activeTab === tab.id
								return (
									<Tab
										key={tab.id}
										type="button"
										value={tab.id}
										className={`group relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left label-sm ${
											isActive
												? 'bg-brand-muted text-link-on-tint'
												: 'text-secondary not-disabled:not-aria-disabled:hover:bg-hover-row not-disabled:not-aria-disabled:hover:text-primary'
										}`}
									>
										<Icon name={tab.icon} className="size-3.5 shrink-0" />
										<span>{tab.label}</span>
									</Tab>
								)
							})}
						</Ariakit.TabList>

						<TabPanel value={activeTab} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
							<div className="p-5 sm:p-6">
								{activeTab === 'balance' && (
									<div className="space-y-6">
										<BalanceSettings result={appliedInitialState?.topupResult} />
										<SettingsCard>
											<ToggleRow
												label="Show balance in sidebar"
												description="Keep your external data balance visible below chat history."
												checked={settings.showBalanceInSidebar}
												onClick={handleShowBalanceInSidebarToggle}
											/>
										</SettingsCard>
									</div>
								)}
								{activeTab === 'persona' && (
									<div className="space-y-6">
										<div>
											<SectionHeading
												title="Custom Instructions"
												subtitle="Tell LlamaAI how to respond. Applied to every conversation."
											/>
											<div
												className="mt-3 space-y-2"
												onBlur={(event) => {
													if (
														event.relatedTarget instanceof Node &&
														event.currentTarget.contains(event.relatedTarget)
													) {
														return
													}
													void commitDraft(instructionsDraft.value)
												}}
											>
												<div className="relative">
													<textarea
														id="llamaai-custom-instructions"
														aria-label="Custom instructions"
														value={instructionsDraft.value}
														maxLength={MAX_LENGTH}
														onChange={(event) =>
															setInstructionsDraft((current) => ({ ...current, value: event.target.value }))
														}
														onKeyDown={(e) => {
															if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
																e.preventDefault()
																void commitDraft(instructionsDraft.value).then(() => dialogStore.hide())
															}
														}}
														placeholder="e.g., Be concise and lead with numbers. Always include % changes."
														className={`${textareaStyles} w-full resize-none`}
														rows={5}
													/>
													{showClear ? (
														<Button
															type="button"
															size="sm"
															variant="ghost"
															onClick={handleClear}
															className="absolute top-1.5 right-1.5"
														>
															Clear
														</Button>
													) : null}
												</div>
												<div className="flex items-center justify-between mono-sm text-tertiary">
													<span>
														{instructionsDraft.value.length}/{MAX_LENGTH}
													</span>
													<span className="hidden sm:inline">⌘↵ to save & close</span>
												</div>
											</div>
										</div>

										<SettingsCard>
											<ToggleRow
												label="Remember preferences"
												description="Let LlamaAI remember your preferences across conversations for personalized responses."
												checked={settings.enableMemory}
												onClick={handleMemoryToggle}
											/>
										</SettingsCard>
									</div>
								)}

								{activeTab === 'app' && (
									<div className="space-y-5">
										<SectionHeading title="Interface" subtitle="How LlamaAI interacts with you in this browser." />
										<SettingsCard>
											<ToggleRow
												label="Completion sound"
												description="Play a short chime when LlamaAI finishes responding in a background tab."
												checked={settings.enableSoundNotifications}
												onClick={handleSoundToggle}
											/>
											<RowDivider />
											<ToggleRow
												label="Enter to send"
												description={
													settings.enterToSend
														? 'Press Enter to send and Shift+Enter for a new line.'
														: 'Press Enter for a new line and Shift+Enter to send.'
												}
												checked={settings.enterToSend}
												onClick={handleEnterToSendToggle}
											/>
											<RowDivider />
											<ToggleRow
												label="Advanced provenance details"
												description="Show the raw query behind a citation by default when you open its sources."
												checked={settings.advancedProvenance}
												onClick={handleAdvancedProvenanceToggle}
											/>
											{notifSupported ? (
												<>
													<RowDivider />
													<ToggleRow
														label="Browser notifications"
														description={
															notifPermission === 'granted'
																? 'Enabled. Turn off in your browser site settings.'
																: notifPermission === 'denied'
																	? 'Blocked. Re-enable in your browser site settings.'
																	: 'Get alerted when LlamaAI finishes responding while the tab is in the background.'
														}
														checked={notifPermission === 'granted'}
														onClick={handleNotifToggle}
														interactive={notifPermission === 'default' && !isRequestingNotif}
													/>
												</>
											) : null}
											{mobileNotificationRow}
										</SettingsCard>
									</div>
								)}

								{activeTab === 'capabilities' && (
									<div className="space-y-6">
										<div>
											<SectionHeading title="Premium tools" subtitle="Paid data sources for deeper research." />
											<div className="mt-3 space-y-3">
												<SettingsCard>
													<ToggleRow
														label="Enable premium tools"
														description="X/Twitter data, people search, and smart-money analytics. Uses your external data balance."
														checked={settings.enablePremiumTools}
														onClick={handlePremiumToolsToggle}
													/>
												</SettingsCard>
												{settings.enablePremiumTools ? (
													<div className="rounded-lg border border-subtle bg-surface p-4">
														<label htmlFor="llamaai-spend-cap" className="block label-md text-primary">
															Spend cap per message
														</label>
														<p className="mt-1 body-sm text-secondary">
															Max external-data spend per message in USD. Each new message gets a fresh budget. Default
															$0.50.
														</p>
														<div className="relative mt-3">
															<span className="pointer-events-none absolute top-0 bottom-0 left-3 my-auto flex items-center font-mono text-tertiary">
																$
															</span>
															<Input
																id="llamaai-spend-cap"
																type="number"
																inputMode="decimal"
																min={0}
																step={0.05}
																value={spendCapDraft}
																onChange={handleSpendCapChange}
																onBlur={handleSpendCapBlur}
																onKeyDown={handleSpendCapKeyDown}
																className="w-full pl-7 font-mono"
															/>
														</div>
													</div>
												) : null}
											</div>
										</div>

										{availableModels && availableModels.length > 0 ? (
											<div>
												<SectionHeading title="Model" subtitle="Override the AI model that powers your responses." />
												<div className="mt-3 space-y-3 rounded-lg border border-subtle bg-surface p-4">
													<SelectField
														id="llamaai-model-select"
														label="Model"
														value={settings.model}
														onChange={handleModelChange}
													>
														<option value="">Default (Sonnet 4.6)</option>
														{availableModels.map((m) => (
															<option key={m.id} value={m.id}>
																{m.label}
															</option>
														))}
													</SelectField>
													{availableEfforts && availableEfforts.length > 0 ? (
														<SelectField
															id="llamaai-effort-select"
															label="Reasoning effort"
															value={settings.effort}
															onChange={handleEffortChange}
														>
															<option value="">Default</option>
															{availableEfforts.map((effort) => (
																<option
																	key={effort.id}
																	value={effort.id}
																	disabled={!isEffortAvailableForModel(effort.id, settings.model)}
																>
																	{effort.label}
																</option>
															))}
														</SelectField>
													) : null}
												</div>
											</div>
										) : null}
									</div>
								)}

								{activeTab === 'integrations' && (
									<div className="space-y-5">
										<SectionHeading
											title="Integrations"
											subtitle="Connect external accounts to chat and receive alerts."
										/>
										{isSettingsLoading ? (
											<div
												role="status"
												aria-label="Loading integrations"
												className="rounded-lg border border-subtle bg-surface p-4"
											>
												<div className="flex items-center justify-between gap-3">
													<div className="flex min-w-0 flex-1 flex-col gap-2">
														<Skeleton className="h-4 w-24" />
														<Skeleton className="h-3 w-full max-w-[360px]" />
													</div>
													<Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
												</div>
											</div>
										) : (
											<div className="flex flex-col gap-3">
												<IntegrationRow
													key={getIntegrationRowResetKey(initialState?.tgloginToken, telegramStatus)}
													kind="telegram"
													title="Telegram"
													description="Chat with LlamaAI and receive alerts in your Telegram DMs."
													initialStatus={telegramStatus}
													initialTgloginToken={initialState?.tgloginToken ?? null}
													onInitialStateConsumed={onInitialStateConsumed}
												/>
												<SlackIntegrationRow
													title="Slack"
													description="Receive scheduled alerts in your Slack channels. Multi-workspace supported."
												/>
												<div className="rounded-lg border border-subtle bg-surface p-4">
													<div className="flex flex-wrap items-start justify-between gap-3">
														<div className="min-w-0 flex-1">
															<p className="m-0 label-md text-primary">Mobile app</p>
															<p className="m-0 mt-0.5 body-sm text-secondary">
																Chat with LlamaAI and receive alerts on your phone. iOS and Android.
															</p>
														</div>
														<Button
															as={BasicLink}
															href="/app"
															data-umami-event="mobile-app-settings-click"
															size="md"
															variant="primary"
														>
															Get the app
														</Button>
													</div>
												</div>
											</div>
										)}
									</div>
								)}

								{activeTab === 'memory' && (
									<div className="space-y-6">
										{agentHome.memories.error ? (
											<RetryNotice
												message="Couldn't load memories."
												retrying={agentHome.memories.isFetching}
												onRetry={() => void agentHome.memories.refetch()}
											/>
										) : null}
										{agentHome.deleteMemoryMutation.error ? (
											<RetryNotice
												message="Couldn't delete this memory."
												retrying={agentHome.deleteMemoryMutation.isPending}
												onRetry={() => agentHome.deleteMemoryMutation.mutate(agentHome.deleteMemoryMutation.variables!)}
											/>
										) : null}
										{agentHome.clearMemoriesMutation.error ? (
											<RetryNotice
												message="Couldn't clear memories."
												retrying={agentHome.clearMemoriesMutation.isPending}
												onRetry={() =>
													agentHome.clearMemoriesMutation.mutate(agentHome.clearMemoriesMutation.variables!)
												}
											/>
										) : null}
										{agentHome.memories.data?.available === false ? (
											<SettingsCard>
												<p className="px-4 py-3.5 body-sm text-secondary">Memory is available on paid plans.</p>
											</SettingsCard>
										) : (
											<>
												<div className="space-y-3">
													<SectionHeading
														title="About you"
														subtitle="Facts the assistant remembers about you across chats."
													/>
													<MemoryList
														entries={agentHome.memories.data?.user}
														isLoading={agentHome.memories.isLoading}
														loadFailed={!!agentHome.memories.error}
														emptyText="Nothing remembered yet."
														onDelete={(id) => agentHome.deleteMemoryMutation.mutate(id)}
														deleting={agentHome.deleteMemoryMutation.isPending}
														deletingId={agentHome.deleteMemoryMutation.variables ?? null}
													/>
													{(agentHome.memories.data?.user.length ?? 0) > 0 ? (
														<Button
															type="button"
															size="sm"
															variant="ghost"
															onClick={() => agentHome.clearMemoriesMutation.mutate('user')}
															disabled={agentHome.clearMemoriesMutation.isPending}
														>
															{agentHome.clearMemoriesMutation.isPending ? <LoadingSpinner size={12} /> : null}Clear all
														</Button>
													) : null}
												</div>

												<div className="space-y-3">
													<SectionHeading
														title="Assistant notes"
														subtitle="Environment and convention notes the assistant keeps for itself."
													/>
													<MemoryList
														entries={agentHome.memories.data?.memory}
														isLoading={agentHome.memories.isLoading}
														loadFailed={!!agentHome.memories.error}
														emptyText="No notes yet."
														onDelete={(id) => agentHome.deleteMemoryMutation.mutate(id)}
														deleting={agentHome.deleteMemoryMutation.isPending}
														deletingId={agentHome.deleteMemoryMutation.variables ?? null}
													/>
													{(agentHome.memories.data?.memory.length ?? 0) > 0 ? (
														<Button
															type="button"
															size="sm"
															variant="ghost"
															onClick={() => agentHome.clearMemoriesMutation.mutate('memory')}
															disabled={agentHome.clearMemoriesMutation.isPending}
														>
															{agentHome.clearMemoriesMutation.isPending ? <LoadingSpinner size={12} /> : null}Clear all
														</Button>
													) : null}
												</div>

												<div className="space-y-3">
													<SectionHeading
														title="Skills"
														subtitle="Workflows saved in your workspace. Archive one to stop the assistant using it."
													/>
													{agentHome.skills.error ? (
														<RetryNotice
															message="Couldn't load skills."
															retrying={agentHome.skills.isFetching}
															onRetry={() => void agentHome.skills.refetch()}
														/>
													) : null}
													{agentHome.archiveSkillMutation.error ? (
														<RetryNotice
															message="Couldn't archive this skill."
															retrying={agentHome.archiveSkillMutation.isPending}
															onRetry={() =>
																agentHome.archiveSkillMutation.mutate(agentHome.archiveSkillMutation.variables!)
															}
														/>
													) : null}
													{agentHome.restoreSkillMutation.error ? (
														<RetryNotice
															message="Couldn't restore this skill."
															retrying={agentHome.restoreSkillMutation.isPending}
															onRetry={() =>
																agentHome.restoreSkillMutation.mutate(agentHome.restoreSkillMutation.variables!)
															}
														/>
													) : null}
													{!agentHome.skills.error || (agentHome.skills.data?.active.length ?? 0) > 0 ? (
														<SettingsCard>
															{agentHome.skills.isLoading ? (
																<div role="status" aria-live="polite" className="px-4 py-3.5">
																	<LoadingIndicator />
																</div>
															) : (agentHome.skills.data?.active.length ?? 0) === 0 ? (
																!agentHome.skills.error ? (
																	<p className="px-4 py-3.5 body-sm text-secondary">No skills yet.</p>
																) : null
															) : (
																agentHome.skills.data!.active.map((skill, i) => (
																	<div key={skill.name}>
																		{i > 0 ? <RowDivider /> : null}
																		<div className="flex items-start justify-between gap-4 px-4 py-3.5">
																			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
																				<p className="m-0 flex items-center gap-2 label-md text-primary">
																					{skill.name}
																					<span className="rounded-sm bg-surface-elevated-2 px-1.5 py-0.5 label-xs text-secondary">
																						{skill.createdBy === 'agent' ? 'learned by assistant' : 'added by you'}
																					</span>
																				</p>
																				<p className="m-0 body-sm text-secondary">{skill.description}</p>
																			</div>
																			{skill.pinned ? (
																				<span className="shrink-0 px-2 py-1 body-sm text-tertiary">Pinned</span>
																			) : (
																				<Button
																					type="button"
																					size="sm"
																					variant="ghost"
																					onClick={() => agentHome.archiveSkillMutation.mutate(skill.name)}
																					disabled={agentHome.archiveSkillMutation.isPending}
																					className="shrink-0"
																				>
																					{agentHome.archiveSkillMutation.isPending &&
																					agentHome.archiveSkillMutation.variables === skill.name ? (
																						<LoadingSpinner size={12} />
																					) : null}
																					Archive
																				</Button>
																			)}
																		</div>
																	</div>
																))
															)}
														</SettingsCard>
													) : null}
													{(agentHome.skills.data?.archived.length ?? 0) > 0 ? (
														<details className="body-sm">
															<summary className="cursor-pointer text-tertiary">
																Archived ({agentHome.skills.data!.archived.length})
															</summary>
															<div className="mt-2 space-y-2">
																{agentHome.skills.data!.archived.map((skill) => (
																	<div key={skill.name} className="flex items-center justify-between gap-4">
																		<span className="min-w-0 flex-1 truncate text-secondary">{skill.name}</span>
																		<Button
																			type="button"
																			size="sm"
																			variant="ghost"
																			onClick={() => agentHome.restoreSkillMutation.mutate(skill.name)}
																			disabled={agentHome.restoreSkillMutation.isPending}
																			className="shrink-0"
																		>
																			{agentHome.restoreSkillMutation.isPending &&
																			agentHome.restoreSkillMutation.variables === skill.name ? (
																				<LoadingSpinner size={12} />
																			) : null}
																			Restore
																		</Button>
																	</div>
																))}
															</div>
														</details>
													) : null}
												</div>
											</>
										)}
									</div>
								)}

								{activeTab === 'lab' ? (
									<div className="space-y-5">
										<SectionHeading title="Experimental" subtitle="Bleeding-edge modes. Things may get weird." />
										{/* The terminal treatment is the product's kept brand exception; the control itself is the shared switch. */}
										<div
											className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 ${
												settings.hackerMode
													? 'border-ai-terminal/30 bg-ai-ink shadow-ai-terminal-glow'
													: 'border-subtle bg-surface'
											}`}
										>
											<div className="flex items-center gap-3">
												<img src="/assets/llamaai/hackerllama.webp" alt="" className="size-11 rounded-lg" />
												<div className="flex flex-col gap-0.5">
													<p
														className={`m-0 label-md ${
															settings.hackerMode
																? 'font-mono text-ai-terminal drop-shadow-ai-terminal'
																: 'text-primary'
														}`}
													>
														{settings.hackerMode ? '> hacker_mode --active' : 'Hacker Mode'}
													</p>
													<p
														className={`m-0 body-sm ${settings.hackerMode ? 'text-ai-on-ink-muted' : 'text-secondary'}`}
													>
														Watch the llama hack through your questions in green.
													</p>
												</div>
											</div>
											<Switch
												label="Hacker Mode"
												hideLabel
												value="hackerMode"
												checked={settings.hackerMode}
												onChange={handleHackerToggle}
												className="shrink-0"
											/>
										</div>
									</div>
								) : null}
							</div>
						</TabPanel>
					</div>
				</Tabs>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
})

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
	return (
		<div className="space-y-1">
			<h3 className="m-0 label-md text-primary">{title}</h3>
			{subtitle ? <p className="m-0 body-md text-secondary">{subtitle}</p> : null}
		</div>
	)
}

function SettingsCard({ children }: { children: React.ReactNode }) {
	return <div className="overflow-hidden rounded-lg border border-subtle bg-surface">{children}</div>
}

function RowDivider() {
	return <div className="mx-4 border-t border-subtle" />
}

function MemoryList({
	entries,
	isLoading,
	loadFailed,
	deletingId,
	emptyText,
	onDelete,
	deleting
}: {
	entries: Array<MemoryEntry> | undefined
	isLoading: boolean
	loadFailed: boolean
	deletingId: string | null
	emptyText: string
	onDelete: (id: string) => void
	deleting: boolean
}) {
	if (loadFailed && !entries?.length) return null
	return (
		<SettingsCard>
			{isLoading ? (
				<div role="status" aria-live="polite" className="px-4 py-3.5">
					<LoadingIndicator />
				</div>
			) : (entries?.length ?? 0) === 0 ? (
				<p className="px-4 py-3.5 body-sm text-secondary">{emptyText}</p>
			) : (
				entries!.map((entry, i) => (
					<div key={entry.id}>
						{i > 0 ? <RowDivider /> : null}
						<div className="flex items-start justify-between gap-4 px-4 py-3.5">
							<p className="m-0 min-w-0 flex-1 body-md whitespace-pre-wrap text-primary">{entry.text}</p>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => onDelete(entry.id)}
								disabled={deleting}
								className="shrink-0"
							>
								{deleting && deletingId === entry.id ? <LoadingSpinner size={12} /> : null}Delete
							</Button>
						</div>
					</div>
				))
			)}
		</SettingsCard>
	)
}

function ToggleRow({
	label,
	description,
	checked,
	onClick,
	interactive = true
}: {
	label: string
	description: string
	checked: boolean
	onClick: () => void
	interactive?: boolean
}) {
	const descriptionId = useId()
	return (
		<div className="flex w-full items-start justify-between gap-4 px-4 py-3.5">
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="m-0 label-md text-primary">{label}</p>
				<p id={descriptionId} className="m-0 body-md text-secondary">
					{description}
				</p>
			</div>
			<Switch
				label={label}
				hideLabel
				value={label}
				checked={checked}
				onChange={onClick}
				disabled={!interactive}
				describedBy={descriptionId}
				className="mt-0.5 shrink-0"
			/>
		</div>
	)
}

function SelectField({
	id,
	label,
	value,
	onChange,
	children
}: {
	id: string
	label: string
	value: string
	onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
	children: React.ReactNode
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="label-sm text-secondary">
				{label}
			</label>
			<div className="relative">
				<select id={id} value={value} onChange={onChange} className={`${inputStyles} w-full appearance-none pr-9`}>
					{children}
				</select>
				<Icon
					name="chevron-down"
					className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-tertiary"
				/>
			</div>
		</div>
	)
}
