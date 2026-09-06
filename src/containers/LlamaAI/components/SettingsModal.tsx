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
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tabs, Tab, TabPanel } from '~/ui/Tabs'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatFixedNumber } from '~/utils/numberFormat'

const MAX_LENGTH = 500

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
	const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
	const [isRequestingNotif, setIsRequestingNotif] = useState(false)
	const [activeTab, setActiveTab] = useState<TabId>('persona')
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
		if (isSettingsTabId(initialState?.tab) && initialState.tab !== activeTab) setActiveTab(initialState.tab)
		if (initialState && !initialState.tgloginToken && onInitialStateConsumed) onInitialStateConsumed()
	}, [activeTab, isOpen, initialState, onInitialStateConsumed])

	const commitDraft = async (value = instructionsDraft.value) => {
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

	useEffect(() => {
		if (activeTab === 'lab' && !isDark) {
			setActiveTab('persona')
		}
	}, [activeTab, isDark])

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

	useEffect(() => {
		if (!isOpen) return
		if (typeof window === 'undefined' || typeof Notification === 'undefined') {
			setNotifPermission('unsupported')
			return
		}
		setNotifPermission(Notification.permission)
	}, [isOpen])

	const handleNotifToggle = useCallback(() => {
		if (notifPermission !== 'default' || isRequestingNotif) return
		trackUmamiEvent('llamaai-notify-settings-enable')
		setIsRequestingNotif(true)
		Notification.requestPermission()
			.then((next) => {
				setNotifPermission(next)
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
		icon: 'pencil' | 'gear-settings' | 'sparkles' | 'flame' | 'link'
	}> = [
		{ id: 'persona', label: 'Persona', icon: 'pencil' },
		{ id: 'app', label: 'App', icon: 'gear-settings' },
		{ id: 'capabilities', label: 'Capabilities', icon: 'sparkles' },
		{ id: 'integrations', label: 'Integrations', icon: 'link' },
		{ id: 'memory', label: 'Memory', icon: 'sparkles' }
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
								<p className="m-0 label-md text-ai-primary">Mobile notifications</p>
								<p className="m-0 text-xs leading-relaxed text-ai-tertiary">
									Loading your mobile notification preference…
								</p>
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
								<p className="m-0 label-md text-ai-primary">Mobile notifications</p>
								<p className="m-0 text-xs leading-relaxed text-ai-tertiary">
									Couldn't load mobile notifications. {mobileNotificationPreference.message}
								</p>
							</div>
							<button
								type="button"
								onClick={mobileNotificationPreference.retry}
								className="shrink-0 text-xs font-medium text-ai-accent-blue-deep underline"
							>
								Try again
							</button>
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
				onClose={() => void commitDraft()}
				className="dialog max-h-[88vh] w-full max-w-[720px] gap-0 overflow-hidden rounded-2xl border border-ai-line-subtle bg-ai-surface-card p-0 shadow-ai-lg"
				backdrop={<div className="backdrop fixed inset-0 bg-ai-backdrop backdrop-blur-md" />}
				portal
				unmountOnHide
			>
				<header className="relative overflow-hidden border-b border-ai-line-subtle">
					<div className="dark:from-ai-accent-blue-deep/7.000000000000001 pointer-events-none absolute inset-0 bg-linear-to-br from-ai-accent-blue-deep/5 via-transparent to-transparent" />
					<div className="relative flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5">
						<div className="flex items-center gap-3">
							<div className="relative flex size-10 items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-ai-accent-blue-deep/15 to-ai-accent-blue-deep/5 ring-1 ring-ai-accent-blue-deep/15 ring-inset">
								<Icon name="settings" className="size-[18px] text-ai-accent-blue-deep" />
							</div>
							<div className="flex flex-col leading-tight">
								<Ariakit.DialogHeading
									render={<h2>Settings</h2>}
									className="m-0 text-[15px] font-semibold tracking-tight text-ai-primary"
								/>
								<p className="m-0 mt-0.5 text-[11px] text-ai-tertiary">Tune how LlamaAI works for you</p>
							</div>
						</div>
						<Ariakit.DialogDismiss
							aria-label="Close settings"
							className="-mr-1.5 rounded-lg p-2 text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-primary"
						>
							<Icon name="x" className="size-4" />
						</Ariakit.DialogDismiss>
					</div>
				</header>

				<Tabs<TabId>
					value={activeTab}
					onValueChange={setActiveTab}
					values={tabs.map((tab) => tab.id)}
					orientation="both"
				>
					<div className="flex min-h-0 flex-col sm:min-h-[480px] sm:flex-row">
						<Ariakit.TabList
							aria-label="Settings sections"
							className="flex shrink-0 gap-1 overflow-x-auto border-b border-ai-line-subtle p-2 sm:w-[180px] sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-r sm:border-b-0 sm:bg-ai-hover-faint sm:p-3"
						>
							{tabs.map((tab) => {
								const isActive = activeTab === tab.id
								return (
									<Tab
										key={tab.id}
										type="button"
										value={tab.id}
										className={`group relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
											isActive
												? 'bg-ai-white text-ai-accent-blue-deep shadow-ai-xs ring-1 ring-ai-line-subtle dark:bg-ai-hover dark:shadow-none dark:ring-ai-line-subtle'
												: 'text-ai-tertiary hover:bg-ai-hover hover:text-ai-primary'
										}`}
									>
										<Icon
											name={tab.icon}
											className={`size-[14px] shrink-0 ${isActive ? 'text-ai-accent-blue-deep' : 'text-ai-muted'}`}
										/>
										<span>{tab.label}</span>
									</Tab>
								)
							})}
						</Ariakit.TabList>

						<TabPanel
							value={activeTab}
							className="max-h-[calc(88vh-130px)] min-w-0 flex-1 overflow-y-auto sm:max-h-[calc(88vh-81px)]"
						>
							<div className="p-5 sm:p-6">
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
													void commitDraft()
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
																void commitDraft().then(() => dialogStore.hide())
															}
														}}
														placeholder="e.g., Be concise and lead with numbers. Always include % changes."
														className="w-full resize-none rounded-xl border border-ai-line-medium bg-ai-hover-faint p-3.5 text-sm text-ai-primary placeholder-ai-muted outline-hidden transition-all focus:border-ai-accent-blue-deep/40 focus:bg-ai-hover focus:ring-4 focus:ring-ai-accent-blue-deep/8 dark:focus:ring-ai-accent-blue-deep/10"
														rows={5}
													/>
													{showClear ? (
														<button
															type="button"
															onClick={handleClear}
															className="absolute top-2.5 right-2.5 rounded-md px-2 py-1 text-[10px] font-medium text-ai-muted transition-colors hover:bg-ai-error-vivid/10 hover:text-ai-error-vivid"
														>
															Clear
														</button>
													) : null}
												</div>
												<div className="flex items-center justify-between font-mono text-[10.5px] text-ai-muted">
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
													<div className="rounded-xl border border-ai-line-subtle bg-ai-hover-faint p-4">
														<label
															htmlFor="llamaai-spend-cap"
															className="block text-[13px] font-medium text-ai-primary"
														>
															Spend cap per message
														</label>
														<p className="mt-1 text-xs text-ai-tertiary">
															Max external-data spend per message in USD. Each new message gets a fresh budget. Default
															$0.50.
														</p>
														<div className="mt-3 flex items-center gap-1 rounded-lg border border-ai-line-medium bg-ai-surface-card px-3 py-2 transition-colors focus-within:border-ai-accent-blue-deep/40 focus-within:ring-4 focus-within:ring-ai-accent-blue-deep/8 dark:focus-within:ring-ai-accent-blue-deep/10">
															<span className="font-mono text-sm text-ai-muted">$</span>
															<input
																id="llamaai-spend-cap"
																type="number"
																inputMode="decimal"
																min={0}
																step={0.05}
																value={spendCapDraft}
																onChange={handleSpendCapChange}
																onBlur={handleSpendCapBlur}
																onKeyDown={handleSpendCapKeyDown}
																className="w-full bg-transparent font-mono text-sm text-ai-primary outline-hidden"
															/>
														</div>
													</div>
												) : null}
											</div>
										</div>

										{availableModels && availableModels.length > 0 ? (
											<div>
												<SectionHeading title="Model" subtitle="Override the AI model that powers your responses." />
												<div className="mt-3 space-y-3 rounded-xl border border-ai-line-subtle bg-ai-hover-faint p-4">
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
											<div className="rounded-xl border border-ai-line-subtle bg-ai-hover-faint p-4">
												<div className="flex items-center justify-between gap-3">
													<div className="min-w-0 flex-1">
														<div className="h-4 w-24 animate-pulse rounded-sm bg-ai-hover-strong" />
														<div className="mt-2 h-3 w-full max-w-[360px] animate-pulse rounded-sm bg-ai-hover" />
													</div>
													<div className="h-8 w-20 shrink-0 animate-pulse rounded-lg bg-ai-hover-strong" />
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
												<div className="rounded-xl border border-ai-line-subtle bg-ai-hover-faint p-4">
													<div className="flex flex-wrap items-start justify-between gap-3">
														<div className="min-w-0 flex-1">
															<p className="m-0 text-sm font-medium text-ai-primary">Mobile app</p>
															<p className="m-0 mt-0.5 text-xs text-ai-tertiary">
																Chat with LlamaAI and receive alerts on your phone. iOS and Android.
															</p>
														</div>
														<BasicLink
															href="/app"
															data-umami-event="mobile-app-settings-click"
															className="shrink-0 rounded-lg bg-ai-accent-blue-deep px-3 py-1.5 text-xs whitespace-nowrap text-ai-white hover:bg-ai-accent-blue-deep/90"
														>
															Get the app
														</BasicLink>
													</div>
												</div>
											</div>
										)}
									</div>
								)}

								{activeTab === 'memory' && (
									<div className="space-y-6">
										{agentHome.memories.data?.available === false ? (
											<SettingsCard>
												<p className="px-4 py-3.5 text-xs text-ai-tertiary">Memory is available on paid plans.</p>
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
														emptyText="Nothing remembered yet."
														onDelete={(id) => agentHome.deleteMemoryMutation.mutate(id)}
														deleting={agentHome.deleteMemoryMutation.isPending}
													/>
													{(agentHome.memories.data?.user.length ?? 0) > 0 ? (
														<button
															type="button"
															onClick={() => agentHome.clearMemoriesMutation.mutate('user')}
															disabled={agentHome.clearMemoriesMutation.isPending}
															className="text-xs font-medium text-ai-muted transition-colors hover:text-ai-error-vivid disabled:opacity-50"
														>
															Clear all
														</button>
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
														emptyText="No notes yet."
														onDelete={(id) => agentHome.deleteMemoryMutation.mutate(id)}
														deleting={agentHome.deleteMemoryMutation.isPending}
													/>
													{(agentHome.memories.data?.memory.length ?? 0) > 0 ? (
														<button
															type="button"
															onClick={() => agentHome.clearMemoriesMutation.mutate('memory')}
															disabled={agentHome.clearMemoriesMutation.isPending}
															className="text-xs font-medium text-ai-muted transition-colors hover:text-ai-error-vivid disabled:opacity-50"
														>
															Clear all
														</button>
													) : null}
												</div>

												<div className="space-y-3">
													<SectionHeading
														title="Skills"
														subtitle="Workflows saved in your workspace. Archive one to stop the assistant using it."
													/>
													<SettingsCard>
														{agentHome.skills.isLoading ? (
															<p className="px-4 py-3.5 text-xs text-ai-tertiary">Loading…</p>
														) : (agentHome.skills.data?.active.length ?? 0) === 0 ? (
															<p className="px-4 py-3.5 text-xs text-ai-tertiary">No skills yet.</p>
														) : (
															agentHome.skills.data!.active.map((skill, i) => (
																<div key={skill.name}>
																	{i > 0 ? <RowDivider /> : null}
																	<div className="flex items-start justify-between gap-4 px-4 py-3.5">
																		<div className="flex min-w-0 flex-1 flex-col gap-0.5">
																			<p className="m-0 flex items-center gap-2 label-md text-ai-primary">
																				{skill.name}
																				<span className="rounded-sm bg-ai-hover px-1.5 py-0.5 text-[10px] font-normal text-ai-tertiary">
																					{skill.createdBy === 'agent' ? 'learned by assistant' : 'added by you'}
																				</span>
																			</p>
																			<p className="m-0 text-xs leading-relaxed text-ai-tertiary">
																				{skill.description}
																			</p>
																		</div>
																		{skill.pinned ? (
																			<span className="shrink-0 px-2 py-1 text-xs text-ai-muted">Pinned</span>
																		) : (
																			<button
																				type="button"
																				onClick={() => agentHome.archiveSkillMutation.mutate(skill.name)}
																				disabled={agentHome.archiveSkillMutation.isPending}
																				className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-error-vivid disabled:opacity-50"
																			>
																				Archive
																			</button>
																		)}
																	</div>
																</div>
															))
														)}
													</SettingsCard>
													{(agentHome.skills.data?.archived.length ?? 0) > 0 ? (
														<details className="text-xs">
															<summary className="cursor-pointer text-ai-muted">
																Archived ({agentHome.skills.data!.archived.length})
															</summary>
															<div className="mt-2 space-y-2">
																{agentHome.skills.data!.archived.map((skill) => (
																	<div key={skill.name} className="flex items-center justify-between gap-4">
																		<span className="min-w-0 flex-1 truncate text-ai-tertiary">{skill.name}</span>
																		<button
																			type="button"
																			onClick={() => agentHome.restoreSkillMutation.mutate(skill.name)}
																			disabled={agentHome.restoreSkillMutation.isPending}
																			className="shrink-0 font-medium text-ai-accent-blue-deep disabled:opacity-50"
																		>
																			Restore
																		</button>
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

								{activeTab === 'lab' && isDark ? (
									<div className="space-y-5">
										<SectionHeading title="Experimental" subtitle="Bleeding-edge modes. Things may get weird." />
										<button
											type="button"
											role="switch"
											aria-checked={settings.hackerMode}
											aria-label="Hacker Mode"
											onClick={handleHackerToggle}
											className={`group relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-xl p-4 text-left transition-all ${
												settings.hackerMode
													? 'bg-ai-ink shadow-ai-terminal-glow ring-1 ring-ai-terminal/30'
													: 'bg-ai-hover-faint ring-1 ring-ai-line-medium hover:ring-ai-line-strong'
											}`}
										>
											{settings.hackerMode ? (
												<div className="pointer-events-none absolute inset-0 opacity-40">
													<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,65,0.18)_1px,transparent_1px)] bg-[length:14px_14px]" />
												</div>
											) : null}
											<div className="relative flex items-center gap-3">
												<img src="/assets/llamaai/hackerllama.webp" alt="" className="size-11 rounded-lg shadow-sm" />
												<div className="flex flex-col gap-0.5">
													<p
														className={`m-0 text-sm font-medium ${
															settings.hackerMode
																? 'font-mono text-ai-terminal drop-shadow-ai-terminal'
																: 'text-ai-white'
														}`}
													>
														{settings.hackerMode ? '> hacker_mode --active' : 'Hacker Mode'}
													</p>
													<p className="m-0 text-xs text-ai-muted">
														Watch the llama hack through your questions in green.
													</p>
												</div>
											</div>
											<div
												className={`relative ml-3 h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${
													settings.hackerMode ? 'bg-ai-terminal shadow-ai-terminal' : 'bg-ai-surface-muted'
												}`}
											>
												<div
													className={`absolute top-[3px] size-4 rounded-full shadow transition-transform duration-200 ${
														settings.hackerMode ? 'translate-x-[19px] bg-ai-ink' : 'translate-x-[3px] bg-ai-white'
													}`}
												/>
											</div>
										</button>
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
			<h3 className="m-0 text-[13px] font-semibold tracking-tight text-ai-primary">{title}</h3>
			{subtitle ? <p className="m-0 text-xs text-ai-tertiary">{subtitle}</p> : null}
		</div>
	)
}

function SettingsCard({ children }: { children: React.ReactNode }) {
	return <div className="overflow-hidden rounded-xl border border-ai-line-subtle bg-ai-hover-faint">{children}</div>
}

function RowDivider() {
	return <div className="mx-4 h-px bg-ai-hover" />
}

function MemoryList({
	entries,
	isLoading,
	emptyText,
	onDelete,
	deleting
}: {
	entries: Array<MemoryEntry> | undefined
	isLoading: boolean
	emptyText: string
	onDelete: (id: string) => void
	deleting: boolean
}) {
	return (
		<SettingsCard>
			{isLoading ? (
				<p className="px-4 py-3.5 text-xs text-ai-tertiary">Loading…</p>
			) : (entries?.length ?? 0) === 0 ? (
				<p className="px-4 py-3.5 text-xs text-ai-tertiary">{emptyText}</p>
			) : (
				entries!.map((entry, i) => (
					<div key={entry.id}>
						{i > 0 ? <RowDivider /> : null}
						<div className="flex items-start justify-between gap-4 px-4 py-3.5">
							<p className="m-0 min-w-0 flex-1 text-[13px] whitespace-pre-wrap text-ai-primary">{entry.text}</p>
							<button
								type="button"
								onClick={() => onDelete(entry.id)}
								disabled={deleting}
								className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-error-vivid disabled:opacity-50"
							>
								Delete
							</button>
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
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			aria-describedby={descriptionId}
			onClick={onClick}
			disabled={!interactive}
			className="group flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-ai-hover-faint disabled:cursor-default disabled:hover:bg-transparent"
		>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="m-0 label-md text-ai-primary">{label}</p>
				<p id={descriptionId} className="m-0 text-xs leading-relaxed text-ai-tertiary">
					{description}
				</p>
			</div>
			<div
				className={`relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${
					checked ? 'bg-ai-accent-blue-deep' : 'bg-ai-black/15 dark:bg-ai-white/15'
				}`}
			>
				<div
					className={`absolute top-[3px] size-4 rounded-full bg-ai-white shadow transition-transform duration-200 ${
						checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
					}`}
				/>
			</div>
		</button>
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
			<label htmlFor={id} className="text-xs font-medium text-ai-tertiary">
				{label}
			</label>
			<div className="relative">
				<select
					id={id}
					value={value}
					onChange={onChange}
					className="w-full appearance-none rounded-lg border border-ai-line-medium bg-ai-surface-card px-3 py-2 pr-9 text-sm text-ai-primary outline-hidden transition-colors focus:border-ai-accent-blue-deep/40 focus:ring-4 focus:ring-ai-accent-blue-deep/8 dark:focus:ring-ai-accent-blue-deep/10"
				>
					{children}
				</select>
				<Icon
					name="chevron-down"
					className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ai-muted"
				/>
			</div>
		</div>
	)
}
