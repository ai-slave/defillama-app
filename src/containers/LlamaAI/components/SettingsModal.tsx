import * as Ariakit from '@ariakit/react'
import { memo, useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
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
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles, textareaStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { Skeleton } from '~/ui/Skeleton'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { Tabs, Tab, TabPanel } from '~/ui/Tabs'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatFixedNumber } from '~/utils/numberFormat'
import { BalanceSettings } from './BalanceSettings'
import { RetryNotice } from './RetryNotice'

const MAX_LENGTH = 5000

type TabId = SettingsTabId

type MemoryRemoval = { kind: 'entry'; id: string } | { kind: 'all'; target: 'user' | 'memory' }

const MEMORY_REMOVAL_COPY = {
	entry: {
		title: 'Delete this memory?',
		description: 'This permanently deletes the memory.',
		confirmLabel: 'Delete',
		pendingLabel: 'Deleting…',
		error: "Couldn't delete this memory. Try again."
	},
	user: {
		title: 'Clear everything about you?',
		description: 'This permanently deletes every fact the assistant remembers about you.',
		confirmLabel: 'Clear all',
		pendingLabel: 'Clearing…',
		error: "Couldn't clear these memories. Try again."
	},
	memory: {
		title: 'Clear all assistant notes?',
		description: 'This permanently deletes every note the assistant keeps for itself.',
		confirmLabel: 'Clear all',
		pendingLabel: 'Clearing…',
		error: "Couldn't clear these notes. Try again."
	}
}

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
	const openingKey = useOpeningKey(isOpen)
	// A failed save shows at the end of the tab it came from, in whichever opening is on screen when it fails; each
	// opening starts clean. A save that fails while the dialog is closed, such as the instructions saved on close, can
	// only be reported by a toast.
	const [saveError, setSaveError] = useState<{ tab: TabId; message: string } | null>(null)
	const [saveErrorOpening, setSaveErrorOpening] = useState(openingKey)
	if (saveErrorOpening !== openingKey) {
		setSaveErrorOpening(openingKey)
		setSaveError(null)
	}
	const save = async (tab: TabId, message: string, request: Promise<boolean>) => {
		setSaveError(null)
		const accepted = await request
		if (accepted) return true
		if (dialogStore.getState().open) setSaveError({ tab, message })
		else toast.error(message)
		return false
	}
	const [savingInstructions, setSavingInstructions] = useState(false)
	const instructionsRef = useRef<HTMLTextAreaElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const removeMemoryDialog = Ariakit.useDialogStore()
	const [memoryRemoval, setMemoryRemoval] = useState<MemoryRemoval>({ kind: 'all', target: 'user' })
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
	// one the compiler cannot reorder. Resolves false only when this save was refused; a draft already
	// submitted counts as saved.
	const commitDraft = async (value: string) => {
		const nextValue = value.trim()
		if (nextValue === lastSubmittedInstructionsRef.current) return true

		lastSubmittedInstructionsRef.current = nextValue
		pendingInstructionsSavesRef.current += 1
		trackUmamiEvent('llamaai-custom-instructions-save')
		const accepted = await save(
			'persona',
			"Couldn't save your instructions. Try again.",
			actions.setCustomInstructions(nextValue).catch(() => false)
		)
		pendingInstructionsSavesRef.current -= 1
		if (accepted) {
			acceptedInstructionsRef.current = nextValue
			setInstructionsDraft((current) => ({ ...current, savedValue: nextValue }))
		} else if (lastSubmittedInstructionsRef.current === nextValue) {
			lastSubmittedInstructionsRef.current = acceptedInstructionsRef.current
		}
		return accepted
	}

	const handleSaveInstructions = () => {
		setSavingInstructions(true)
		void commitDraft(instructionsDraft.value).then((saved) => {
			setSavingInstructions(false)
			// A saved draft hides the Save button, so focus returns to the field instead of dropping to the page.
			if (saved) instructionsRef.current?.focus()
		})
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

	const saveSetting = (tab: TabId, request: Promise<boolean>) =>
		void save(tab, "Couldn't save that setting. Try again.", request)

	const handleMemoryToggle = () => {
		trackUmamiEvent('llamaai-memory-toggle')
		saveSetting('persona', actions.setEnableMemory(!settings.enableMemory))
	}

	const handlePremiumToolsToggle = () => {
		trackUmamiEvent('llamaai-premium-tools-toggle')
		saveSetting('capabilities', actions.setEnablePremiumTools(!settings.enablePremiumTools))
	}

	const handleHackerToggle = () => {
		trackUmamiEvent('llamaai-hacker-mode-toggle')
		saveSetting('lab', actions.setHackerMode(!settings.hackerMode))
	}

	const handleSoundToggle = () => {
		trackUmamiEvent('llamaai-sound-notifications-toggle')
		saveSetting('app', actions.setEnableSoundNotifications(!settings.enableSoundNotifications))
	}

	const handleMobileNotificationToggle = () => {
		if (
			!mobileNotificationPreference ||
			!isWebMobileToggleVisible(mobileNotificationPreference) ||
			!setMobileNotificationEnabled ||
			setMobileNotificationEnabled.isPending
		)
			return
		trackUmamiEvent('llamaai-mobile-notifications-toggle')
		void setMobileNotificationEnabled.mutateAsync(!mobileNotificationPreference.enabled).catch(() => undefined)
	}

	const handleEnterToSendToggle = () => {
		trackUmamiEvent('llamaai-enter-to-send-toggle')
		saveSetting('app', actions.setEnterToSend(!settings.enterToSend))
	}

	const handleAdvancedProvenanceToggle = () => {
		trackUmamiEvent('llamaai-advanced-provenance-toggle')
		saveSetting('app', actions.setAdvancedProvenance(!settings.advancedProvenance))
	}

	const handleShowBalanceInSidebarToggle = () => {
		trackUmamiEvent('llamaai-sidebar-balance-toggle')
		saveSetting('balance', actions.setShowBalanceInSidebar(!settings.showBalanceInSidebar))
	}

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

	const commitSpendCap = (raw: string) => {
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
		void save('capabilities', "Couldn't save your spend cap. Try again.", actions.setSpendCapPerMessage(parsed)).then(
			(accepted) => {
				pendingSpendCapSavesRef.current -= 1
				if (!accepted && lastSubmittedSpendCapRef.current === parsed) {
					lastSubmittedSpendCapRef.current = latestSpendCapRef.current
					setSpendCapDraft(formatFixedNumber(latestSpendCapRef.current, 2))
				}
			}
		)
	}

	const handleSpendCapKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			commitSpendCap(e.currentTarget.value)
			e.currentTarget.blur()
		}
	}

	const handleNotifToggle = () => {
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
	}

	const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const nextModel = e.target.value
		saveSetting('capabilities', actions.setModel(nextModel))
		if (settings.effort && !isEffortAvailableForModel(settings.effort, nextModel)) {
			saveSetting('capabilities', actions.setEffort(''))
		}
	}

	const handleEffortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const nextEffort = e.target.value
		if (nextEffort && !isEffortAvailableForModel(nextEffort, settings.model)) return
		saveSetting('capabilities', actions.setEffort(nextEffort))
	}

	const openMemoryRemoval = (removal: MemoryRemoval) => {
		setMemoryRemoval(removal)
		// An error from an earlier removal belongs to that confirmation, not this one.
		if (removal.kind === 'entry') agentHome.deleteMemoryMutation.reset()
		else agentHome.clearMemoriesMutation.reset()
		removeMemoryDialog.show()
	}

	const closeMemoryRemoval = () => removeMemoryDialog.hide()
	const confirmMemoryRemoval = () => {
		if (memoryRemoval.kind === 'entry')
			agentHome.deleteMemoryMutation.mutate(memoryRemoval.id, { onSuccess: closeMemoryRemoval })
		else agentHome.clearMemoriesMutation.mutate(memoryRemoval.target, { onSuccess: closeMemoryRemoval })
	}

	const memoryRemovalCopy = MEMORY_REMOVAL_COPY[memoryRemoval.kind === 'entry' ? 'entry' : memoryRemoval.target]
	const memoryRemovalMutation =
		memoryRemoval.kind === 'entry' ? agentHome.deleteMemoryMutation : agentHome.clearMemoriesMutation
	const visibleSaveError = saveError?.tab === activeTab ? saveError : null

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
		<Dialog
			size="lg"
			fullSheet
			store={dialogStore}
			onClose={() => {
				setAppliedInitialState(null)
				void commitDraft(instructionsDraft.value)
			}}
			portal
			unmountOnHide
		>
			<DialogHeader title="Settings" subtitle="Tune how LlamaAI works for you" />
			<Tabs<TabId>
				value={activeTab}
				onValueChange={setSelectedTab}
				values={tabs.map((tab) => tab.id)}
				orientation="both"
			>
				{/* One scroll region for both panes: the section list sticks to its top, as a strip on phones and a
				    rail from sm. */}
				<DialogBody kind="flush">
					<div className="flex flex-col sm:min-h-[480px] sm:flex-row">
						<div className="sticky top-0 z-10 shrink-0 border-b border-subtle bg-overlay sm:static sm:w-[180px] sm:border-r sm:border-b-0 sm:bg-page">
							<Ariakit.TabList
								aria-label="Settings sections"
								className="flex gap-1 overflow-x-auto p-2 sm:sticky sm:top-0 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:p-3"
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
						</div>

						<TabPanel ref={panelRef} value={activeTab} className="flex min-w-0 flex-1 flex-col gap-4 p-4">
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
											title="Custom instructions"
											subtitle="Tell LlamaAI how to respond. Applied to every conversation."
										/>
										<div
											className="mt-3 space-y-2"
											onBlur={(event) => {
												if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
													return
												}
												void commitDraft(instructionsDraft.value)
											}}
										>
											<div className="relative">
												<textarea
													ref={instructionsRef}
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
															// A refused save keeps the dialog open, where its error shows.
															void commitDraft(instructionsDraft.value).then((saved) => {
																if (saved) dialogStore.hide()
															})
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
											<div className="flex min-h-6 items-center justify-between gap-3 mono-sm text-tertiary">
												<span>
													{instructionsDraft.value.length}/{MAX_LENGTH}
												</span>
												<div className="flex items-center gap-3">
													<span className="hidden sm:inline">⌘↵ to save & close</span>
													{instructionsDirty || savingInstructions ? (
														<Button
															type="button"
															size="sm"
															pendingLabel={savingInstructions ? 'Saving…' : null}
															onClick={handleSaveInstructions}
														>
															Save
														</Button>
													) : null}
												</div>
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
															onChange={(e) => setSpendCapDraft(e.target.value)}
															onBlur={(e) => commitSpendCap(e.target.value)}
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
													onDelete={(id) => openMemoryRemoval({ kind: 'entry', id })}
												/>
												{(agentHome.memories.data?.user.length ?? 0) > 0 ? (
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onClick={() => openMemoryRemoval({ kind: 'all', target: 'user' })}
													>
														Clear all
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
													onDelete={(id) => openMemoryRemoval({ kind: 'entry', id })}
												/>
												{(agentHome.memories.data?.memory.length ?? 0) > 0 ? (
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onClick={() => openMemoryRemoval({ kind: 'all', target: 'memory' })}
													>
														Clear all
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
																				pendingLabel={
																					agentHome.archiveSkillMutation.isPending &&
																					agentHome.archiveSkillMutation.variables === skill.name
																						? 'Archiving…'
																						: null
																				}
																				className="shrink-0"
																			>
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
																		pendingLabel={
																			agentHome.restoreSkillMutation.isPending &&
																			agentHome.restoreSkillMutation.variables === skill.name
																				? 'Restoring…'
																				: null
																		}
																		className="shrink-0"
																	>
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
									<ConfirmDialog
										store={removeMemoryDialog}
										portal
										unmountOnHide
										autoFocusOnHide={(element) => {
											// A removal takes its Delete or Clear all button with it; focus the section instead.
											if (element?.isConnected) return true
											panelRef.current?.focus()
											return false
										}}
										title={memoryRemovalCopy.title}
										description={memoryRemovalCopy.description}
										confirmLabel={memoryRemovalCopy.confirmLabel}
										pendingLabel={memoryRemovalMutation.isPending ? memoryRemovalCopy.pendingLabel : null}
										error={memoryRemovalMutation.error ? memoryRemovalCopy.error : null}
										onConfirm={confirmMemoryRemoval}
									/>
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
														settings.hackerMode ? 'font-mono text-ai-terminal drop-shadow-ai-terminal' : 'text-primary'
													}`}
												>
													{settings.hackerMode ? '> hacker_mode --active' : 'Hacker mode'}
												</p>
												<p className={`m-0 body-sm ${settings.hackerMode ? 'text-ai-on-ink-muted' : 'text-secondary'}`}>
													Watch the llama hack through your questions in green.
												</p>
											</div>
										</div>
										<Switch
											label="Hacker mode"
											hideLabel
											value="hackerMode"
											checked={settings.hackerMode}
											onChange={handleHackerToggle}
											className="shrink-0"
										/>
									</div>
								</div>
							) : null}
							{visibleSaveError ? <InlineStatus variant="error">{visibleSaveError.message}</InlineStatus> : null}
						</TabPanel>
					</div>
				</DialogBody>
			</Tabs>
		</Dialog>
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
	emptyText,
	onDelete
}: {
	entries: Array<MemoryEntry> | undefined
	isLoading: boolean
	loadFailed: boolean
	emptyText: string
	onDelete: (id: string) => void
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
							<Button type="button" size="sm" variant="ghost" onClick={() => onDelete(entry.id)} className="shrink-0">
								Delete
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
