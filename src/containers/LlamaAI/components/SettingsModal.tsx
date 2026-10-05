import * as Ariakit from '@ariakit/react'
import { memo, useId, useRef, useState, type ReactNode } from 'react'
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
	ModelOption,
	SaveLlamaAISettings
} from '~/containers/LlamaAI/hooks/useLlamaAISettings'
import {
	requestNotificationPermission,
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
import { Dialog, DialogBody, DialogHeader, useDialogLeave, useOpeningKey } from '~/ui/Dialog'
import { neighbourRowControl, takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles, textareaStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { Skeleton } from '~/ui/Skeleton'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Switch } from '~/ui/Switch'
import { Tabs, Tab, TabPanel } from '~/ui/Tabs'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { formatFixedNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { BalanceSettings } from './BalanceSettings'
import { RetryNotice } from './RetryNotice'
import { RAIL_TAB } from './tabRailStyles'

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

// The spend cap commits on blur, so Enter only leaves the field.
function handleSpendCapKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
	if (e.key === 'Enter') {
		e.preventDefault()
		e.currentTarget.blur()
	}
}

// The reader's instructions text; `saved` is the value a save accepted for it, until settings report that value.
type InstructionsDraft = { text: string; saved: string | null }

interface SettingsModalProps {
	dialogStore: Ariakit.DialogStore
	settings: LlamaAISettings
	saveSettings: SaveLlamaAISettings
	availableModels: Array<ModelOption>
	availableEfforts: Array<EffortOption>
	telegramStatus: TelegramStatus | null
	isSettingsLoading: boolean
	initialState: SettingsInitialState | null
	onInitialStateConsumed: () => void
	mobileNotificationPreference: WebMobilePreference
	setMobileNotificationEnabled: WebMobilePushEnabledMutation
}

export const SettingsModal = memo(function SettingsModal({
	dialogStore,
	settings,
	saveSettings,
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
	const memoriesFailed = queryReadFailed(agentHome.memories)
	const skillsFailed = queryReadFailed(agentHome.skills)
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
	// The error stays while its retry runs and leaves once a save from the same tab lands.
	const save = async (tab: TabId, message: string, request: Promise<boolean>) => {
		const accepted = await request
		if (accepted) {
			setSaveError((current) => (current?.tab === tab ? null : current))
			return true
		}
		if (dialogStore.getState().open) setSaveError({ tab, message })
		else toast.error(message)
		return false
	}
	const [savingInstructions, setSavingInstructions] = useState(false)
	const instructionsRef = useRef<HTMLTextAreaElement>(null)
	const removeMemoryDialog = Ariakit.useDialogStore()
	const [memoryRemoval, setMemoryRemoval] = useState<MemoryRemoval>({ kind: 'all', target: 'user' })
	// The reader's text, or null while the field shows the saved instructions, so a refresh reaches a clean field and
	// never a typed one. `saved` marks text a save accepted: the settings prop reports it a task later (through
	// storage), and the draft gives way then. Dropping it when the save resolves would flash the old value first.
	const [instructionsDraft, setInstructionsDraft] = useState<InstructionsDraft | null>(null)
	const savedInstructions = settings.customInstructions.trim()
	if (instructionsDraft?.saved != null && instructionsDraft.saved === savedInstructions) setInstructionsDraft(null)
	const instructionsValue = instructionsDraft?.text ?? settings.customInstructions
	const instructionsDirty =
		instructionsDraft !== null &&
		instructionsDraft.saved === null &&
		instructionsDraft.text.trim() !== savedInstructions
	// Blur, Save, ⌘↵ and closing can all commit the same text; while it is in flight they share its request.
	const instructionsSaveRef = useRef<{ value: string; request: Promise<boolean> } | null>(null)

	// Resolves false only when this save was refused. A save answers for the draft it was given: any later edit,
	// even one back to the same text, is a new draft and stays one.
	const commitDraft = async (draft: InstructionsDraft | null) => {
		if (draft === null || draft.saved !== null) return true
		const nextValue = draft.text.trim()
		const inFlight = instructionsSaveRef.current
		if (!inFlight && nextValue === savedInstructions) {
			setInstructionsDraft((current) => (current === draft ? null : current))
			return true
		}

		let request = inFlight?.value === nextValue ? inFlight.request : null
		if (!request) {
			trackUmamiEvent('llamaai-custom-instructions-save')
			request = save(
				'persona',
				"Couldn't save your instructions. Try again.",
				saveSettings({ customInstructions: nextValue })
			)
			instructionsSaveRef.current = { value: nextValue, request }
		}
		const accepted = await request
		if (instructionsSaveRef.current?.request === request) instructionsSaveRef.current = null
		// A refused save keeps the draft, so the reader can retry it.
		if (accepted) {
			setInstructionsDraft((current) => (current === draft ? { text: draft.text, saved: nextValue } : current))
		}
		return accepted
	}

	const handleSaveInstructions = () => {
		setSavingInstructions(true)
		void commitDraft(instructionsDraft).then((saved) => {
			setSavingInstructions(false)
			// A saved draft hides the Save button, so focus returns to the field instead of dropping to the page.
			if (saved) instructionsRef.current?.focus()
		})
	}

	// Clearing saved instructions erases them for every chat, so it asks first; an unsaved draft clears at once.
	const [confirmingClear, setConfirmingClear] = useState(false)
	const clearInstructions = () => {
		const cleared = { text: '', saved: null }
		setInstructionsDraft(cleared)
		void commitDraft(cleared)
		// Clear leaves once nothing is saved or typed; the emptied field keeps focus.
		instructionsRef.current?.focus()
	}
	const handleClear = () => {
		if (savedInstructions.length > 0) setConfirmingClear(true)
		else clearInstructions()
	}

	const saveSetting = (tab: TabId, request: Promise<boolean>) =>
		void save(tab, "Couldn't save that setting. Try again.", request)

	const handleMemoryToggle = () => {
		trackUmamiEvent('llamaai-memory-toggle')
		saveSetting('persona', saveSettings({ enableMemory: !settings.enableMemory }))
	}

	const handlePremiumToolsToggle = () => {
		trackUmamiEvent('llamaai-premium-tools-toggle')
		saveSetting('capabilities', saveSettings({ enablePremiumTools: !settings.enablePremiumTools }))
	}

	const handleHackerToggle = () => {
		trackUmamiEvent('llamaai-hacker-mode-toggle')
		saveSetting('lab', saveSettings({ hackerMode: !settings.hackerMode }))
	}

	const handleSoundToggle = () => {
		trackUmamiEvent('llamaai-sound-notifications-toggle')
		saveSetting('app', saveSettings({ enableSoundNotifications: !settings.enableSoundNotifications }))
	}

	const handleMobileNotificationToggle = () => {
		if (!isWebMobileToggleVisible(mobileNotificationPreference) || setMobileNotificationEnabled.isPending) return
		trackUmamiEvent('llamaai-mobile-notifications-toggle')
		void setMobileNotificationEnabled.mutateAsync(!mobileNotificationPreference.enabled).catch(() => undefined)
	}

	const handleEnterToSendToggle = () => {
		trackUmamiEvent('llamaai-enter-to-send-toggle')
		saveSetting('app', saveSettings({ enterToSend: !settings.enterToSend }))
	}

	const handleAdvancedProvenanceToggle = () => {
		trackUmamiEvent('llamaai-advanced-provenance-toggle')
		saveSetting('app', saveSettings({ advancedProvenance: !settings.advancedProvenance }))
	}

	const handleShowBalanceInSidebarToggle = () => {
		trackUmamiEvent('llamaai-sidebar-balance-toggle')
		saveSetting('balance', saveSettings({ showBalanceInSidebar: !settings.showBalanceInSidebar }))
	}

	// The reader's text, or null while the field shows the saved cap. A committed cap shows until its save settles;
	// the save updates the cap at once and rolls it back if refused, so the field then shows whichever stands.
	const [spendCapEdit, setSpendCapEdit] = useState<string | null>(null)
	const spendCapValue = spendCapEdit ?? formatFixedNumber(settings.spendCapPerMessage, 2)

	const commitSpendCap = (raw: string) => {
		const parsed = Number(raw)
		if (!Number.isFinite(parsed) || parsed < 0 || parsed === settings.spendCapPerMessage) {
			setSpendCapEdit(null)
			return
		}
		const shown = formatFixedNumber(parsed, 2)
		setSpendCapEdit(shown)
		trackUmamiEvent('llamaai-spend-cap-change')
		void save(
			'capabilities',
			"Couldn't save your spend cap. Try again.",
			saveSettings({ spendCapPerMessage: parsed })
		).then(() => setSpendCapEdit((edit) => (edit === shown ? null : edit)))
	}

	const handleNotifToggle = () => {
		if (notifPermission !== 'default' || isRequestingNotif) return
		trackUmamiEvent('llamaai-notify-settings-enable')
		setIsRequestingNotif(true)
		void requestNotificationPermission(markNotifBannerDismissed).finally(() => setIsRequestingNotif(false))
	}

	const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const nextModel = e.target.value
		saveSetting('capabilities', saveSettings({ model: nextModel }))
		if (settings.effort && !isEffortAvailableForModel(settings.effort, nextModel)) {
			saveSetting('capabilities', saveSettings({ effort: '' }))
		}
	}

	const handleEffortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const nextEffort = e.target.value
		if (nextEffort && !isEffortAvailableForModel(nextEffort, settings.model)) return
		saveSetting('capabilities', saveSettings({ effort: nextEffort }))
	}

	// Where the confirmation returns focus when its trigger will not survive; null returns it to the trigger.
	const memoryRemovalFocus = useRef<HTMLElement | null>(null)
	const openMemoryRemoval = (removal: MemoryRemoval) => {
		memoryRemovalFocus.current = null
		setMemoryRemoval(removal)
		// An error from an earlier removal belongs to that confirmation, not this one.
		if (removal.kind === 'entry') agentHome.deleteMemoryMutation.reset()
		else agentHome.clearMemoriesMutation.reset()
		removeMemoryDialog.show()
	}

	const closeMemoryRemoval = () => removeMemoryDialog.hide()
	const confirmMemoryRemoval = () => {
		// A cleared list leaves Clear all nothing to hand focus to; the dialog's net takes it once the refetch lands.
		if (memoryRemoval.kind === 'all') {
			agentHome.clearMemoriesMutation.mutate(memoryRemoval.target, { onSuccess: closeMemoryRemoval })
			return
		}
		// The confirmation closes before the refetch that removes the entry's row lands, so it closes onto the next
		// entry's Delete, else the previous one's, instead of the doomed one. The last entry leaves it to the net.
		// Ariakit takes the trigger from focus: a press that did not focus the entry's Delete leaves no row to go from.
		const trigger = removeMemoryDialog.getState().disclosureElement
		const row = trigger?.closest('li')
		const next = row ? neighbourRowControl(row, trigger!) : null
		agentHome.deleteMemoryMutation.mutate(memoryRemoval.id, {
			onSuccess: () => {
				memoryRemovalFocus.current = next ?? null
				closeMemoryRemoval()
			}
		})
	}
	// The last failed archive or restore, not the mutations' own errors: those clear as soon as a retry starts.
	const [skillMoveError, setSkillMoveError] = useState<{ action: 'archive' | 'restore'; name: string } | null>(null)
	const skillMutations = { archive: agentHome.archiveSkillMutation, restore: agentHome.restoreSkillMutation }
	// An archived or restored skill leaves its list once the skills refetch, and its button hands focus on first.
	// A retry from the error has no row button; its notice hands focus on as it leaves.
	const moveSkill = (action: 'archive' | 'restore', name: string, button: HTMLButtonElement | null) => {
		const next = button ? neighbourRowControl(button.closest('li')!, button) : null
		skillMutations[action].mutate(name, {
			onSuccess: () => {
				setSkillMoveError((current) => (current?.action === action ? null : current))
				if (button && document.activeElement === button) next?.focus()
			},
			onError: () => setSkillMoveError({ action, name })
		})
	}

	const memoryRemovalCopy = MEMORY_REMOVAL_COPY[memoryRemoval.kind === 'entry' ? 'entry' : memoryRemoval.target]
	const memoryRemovalMutation =
		memoryRemoval.kind === 'entry' ? agentHome.deleteMemoryMutation : agentHome.clearMemoriesMutation
	const visibleSaveError = saveError?.tab === activeTab ? saveError : null

	const showClear = instructionsDirty || savedInstructions.length > 0
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
					{/* Replaces the error row whose Try again had focus. */}
					<div ref={focusSwitchIfLost}>
						<ToggleRow
							label="Mobile notifications"
							description={
								setMobileNotificationEnabled.error
									? "Couldn't update mobile notifications. Try again."
									: setMobileNotificationEnabled.isPending
										? 'Updating your mobile notification preference…'
										: mobileNotificationPreference.enabled
											? 'Notify your phone when you leave a web chat before LlamaAI finishes.'
											: 'Get notified on your phone when a web response finishes after you leave.'
							}
							checked={mobileNotificationPreference.enabled}
							onClick={handleMobileNotificationToggle}
							interactive={!setMobileNotificationEnabled.isPending}
						/>
					</div>
				</>
			)
			break
		default: {
			const _exhaustive: never = mobileNotificationPreference
			void _exhaustive
		}
	}

	return (
		<Dialog
			size="lg"
			fullSheet
			store={dialogStore}
			onClose={() => {
				setAppliedInitialState(null)
				void commitDraft(instructionsDraft)
			}}
			portal
			unmountOnHide
		>
			<DialogHeader title="Settings" subtitle="Tune how LlamaAI works for you" />
			<SettingsTabs
				value={activeTab}
				onValueChange={setSelectedTab}
				values={tabs.map((tab) => tab.id)}
				orientation="both"
			>
				{/* One scroll region for both panes: the section list sticks to its top, as a strip on phones and a
				    rail from sm. */}
				<DialogBody kind="flush">
					<div className="flex flex-col sm:min-h-[480px] sm:flex-row">
						<div className="sticky top-0 z-10 shrink-0 border-b border-subtle bg-overlay sm:static sm:w-48 sm:border-r sm:border-b-0 sm:bg-page">
							<Ariakit.TabList
								aria-label="Settings sections"
								className="flex gap-1 overflow-x-auto p-2 sm:sticky sm:top-0 sm:flex-col sm:gap-0.5 sm:overflow-visible"
							>
								{tabs.map((tab) => (
									<Tab key={tab.id} type="button" value={tab.id} className={RAIL_TAB}>
										<Icon name={tab.icon} className="size-3.5 shrink-0" />
										<span>{tab.label}</span>
									</Tab>
								))}
							</Ariakit.TabList>
						</div>

						<TabPanel value={activeTab} className="flex min-w-0 flex-1 flex-col gap-4 p-4">
							{activeTab === 'balance' && (
								<div className="space-y-6">
									<BalanceSettings
										result={appliedInitialState?.topupResult}
										balanceBefore={appliedInitialState?.topupBalanceBefore}
									/>
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
												// Focus moving into the Clear confirmation is not the reader leaving the draft.
												if (confirmingClear) return
												void commitDraft(instructionsDraft)
											}}
										>
											<div className="relative">
												<textarea
													ref={instructionsRef}
													id="llamaai-custom-instructions"
													aria-label="Custom instructions"
													value={instructionsValue}
													maxLength={MAX_LENGTH}
													onChange={(event) => setInstructionsDraft({ text: event.target.value, saved: null })}
													onKeyDown={(e) => {
														if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
															e.preventDefault()
															// A refused save keeps the dialog open, where its error shows.
															void commitDraft(instructionsDraft).then((saved) => {
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
												<ConfirmDialog
													open={confirmingClear}
													onClose={() => setConfirmingClear(false)}
													// Clearing removes the Clear button; the emptied field takes focus.
													finalFocus={instructionsRef}
													portal
													unmountOnHide
													title="Clear your instructions?"
													description="LlamaAI stops following your saved custom instructions in every chat."
													confirmLabel="Clear"
													pendingLabel={null}
													error={null}
													onConfirm={() => {
														setConfirmingClear(false)
														clearInstructions()
													}}
												/>
											</div>
											<div className="flex min-h-6 items-center justify-between gap-3 mono-sm text-tertiary">
												<span>
													{instructionsValue.length}/{MAX_LENGTH}
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
															value={spendCapValue}
															onChange={(e) => setSpendCapEdit(e.target.value)}
															onBlur={(e) => commitSpendCap(e.target.value)}
															onKeyDown={handleSpendCapKeyDown}
															className="w-full pl-7 font-mono"
														/>
													</div>
												</div>
											) : null}
										</div>
									</div>

									{availableModels.length > 0 ? (
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
												{availableEfforts.length > 0 ? (
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
									{memoriesFailed ? (
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
													loadFailed={memoriesFailed}
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
													loadFailed={memoriesFailed}
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
												{skillsFailed ? (
													<RetryNotice
														message="Couldn't load skills."
														retrying={agentHome.skills.isFetching}
														onRetry={() => void agentHome.skills.refetch()}
													/>
												) : null}
												{skillMoveError ? (
													<RetryNotice
														message={`Couldn't ${skillMoveError.action} this skill.`}
														retrying={
															skillMutations[skillMoveError.action].isPending &&
															skillMutations[skillMoveError.action].variables === skillMoveError.name
														}
														onRetry={() => moveSkill(skillMoveError.action, skillMoveError.name, null)}
													/>
												) : null}
												{!skillsFailed || (agentHome.skills.data?.active.length ?? 0) > 0 ? (
													<SettingsCard>
														{agentHome.skills.isLoading ? (
															<div role="status" aria-live="polite" className="px-4 py-3.5">
																<LoadingIndicator />
															</div>
														) : (agentHome.skills.data?.active.length ?? 0) === 0 ? (
															!skillsFailed ? (
																<p className="px-4 py-3.5 body-sm text-secondary">No skills yet.</p>
															) : null
														) : (
															<ul>
																{agentHome.skills.data!.active.map((skill, i) => (
																	<li key={skill.name}>
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
																					onClick={(event) => moveSkill('archive', skill.name, event.currentTarget)}
																					// Focusable while another skill archives: the archived row hands focus to it.
																					disabled={agentHome.archiveSkillMutation.isPending}
																					accessibleWhenDisabled
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
																	</li>
																))}
															</ul>
														)}
													</SettingsCard>
												) : null}
												{(agentHome.skills.data?.archived.length ?? 0) > 0 ? (
													<details className="body-sm">
														<summary className="cursor-pointer text-tertiary">
															Archived ({agentHome.skills.data!.archived.length})
														</summary>
														<ul className="mt-2 space-y-2">
															{agentHome.skills.data!.archived.map((skill) => (
																<li key={skill.name} className="flex items-center justify-between gap-4">
																	<span className="min-w-0 flex-1 truncate text-secondary">{skill.name}</span>
																	<Button
																		type="button"
																		size="sm"
																		variant="ghost"
																		onClick={(event) => moveSkill('restore', skill.name, event.currentTarget)}
																		// Focusable while another skill restores: the restored row hands focus to it.
																		disabled={agentHome.restoreSkillMutation.isPending}
																		accessibleWhenDisabled
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
																</li>
															))}
														</ul>
													</details>
												) : null}
											</div>
										</>
									)}
									<ConfirmDialog
										store={removeMemoryDialog}
										finalFocus={memoryRemovalFocus}
										portal
										unmountOnHide
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
			</SettingsTabs>
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

// A stable ref, so it runs only when the row mounts in place of the error row whose Try again had focus.
const focusSwitchIfLost = (row: HTMLDivElement | null) => takeLostFocus(row?.querySelector('input') ?? null)

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
				<ul>
					{entries!.map((entry, i) => (
						<li key={entry.id}>
							{i > 0 ? <RowDivider /> : null}
							<div className="flex items-start justify-between gap-4 px-4 py-3.5">
								<p id={`memory-${entry.id}`} className="m-0 min-w-0 flex-1 body-md whitespace-pre-wrap text-primary">
									{entry.text}
								</p>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => onDelete(entry.id)}
									aria-describedby={`memory-${entry.id}`}
									className="shrink-0"
								>
									Delete
								</Button>
							</div>
						</li>
					))}
				</ul>
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

/** Switching tabs leaves the current one. Inside a guarded step, such as a top-up payment on the Balance tab, the
    guard asks first. */
function SettingsTabs({
	onValueChange,
	...props
}: {
	value: TabId
	onValueChange: (tab: TabId) => void
	values: ReadonlyArray<TabId>
	orientation: 'both'
	children: ReactNode
}) {
	const leave = useDialogLeave()
	return <Tabs<TabId> {...props} onValueChange={(tab) => leave(() => onValueChange(tab))} />
}
