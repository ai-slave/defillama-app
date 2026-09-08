import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { removeStorageItem, setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { getErrorMessage } from '~/utils/error'

export const LLAMA_AI_CUSTOM_INSTRUCTIONS_KEY = 'llamaai-custom-instructions'
export const LLAMA_AI_ENABLE_MEMORY_KEY = 'llamaai-enable-memory'
export const LLAMA_AI_ENABLE_PREMIUM_TOOLS_KEY = 'llamaai-enable-premium-tools'
export const LLAMA_AI_HACKER_MODE_KEY = 'llamaai-hacker-mode'
export const LLAMA_AI_MODEL_KEY = 'llamaai-model'
export const LLAMA_AI_EFFORT_KEY = 'llamaai-effort'
export const LLAMA_AI_ENABLE_SOUND_KEY = 'llamaai-enable-sound'
export const LLAMA_AI_ENTER_TO_SEND_KEY = 'llamaai-enter-to-send'
export const LLAMA_AI_ADVANCED_PROVENANCE_KEY = 'llamaai-advanced-provenance'
export const LLAMA_AI_SPEND_CAP_KEY = 'llamaai-spend-cap-per-message'
export const LLAMA_AI_SETTINGS_QUERY_KEY = ['llama-ai-settings'] as const

export const LLAMA_AI_SPEND_CAP_DEFAULT = 0.5

export interface LlamaAISettings {
	customInstructions: string
	enableMemory: boolean
	enablePremiumTools: boolean
	hackerMode: boolean
	model: string
	effort: string
	enableSoundNotifications: boolean
	enterToSend: boolean
	advancedProvenance: boolean
	spendCapPerMessage: number
}

export interface LlamaAISettingsActions {
	setCustomInstructions: (value: string) => Promise<boolean>
	setEnableMemory: (value: boolean) => Promise<boolean>
	setEnablePremiumTools: (value: boolean) => Promise<boolean>
	setHackerMode: (value: boolean) => Promise<boolean>
	setModel: (value: string) => Promise<boolean>
	setEffort: (value: string) => Promise<boolean>
	setEnableSoundNotifications: (value: boolean) => Promise<boolean>
	setEnterToSend: (value: boolean) => Promise<boolean>
	setAdvancedProvenance: (value: boolean) => Promise<boolean>
	setSpendCapPerMessage: (value: number) => Promise<boolean>
}

type LlamaAISettingKey = keyof LlamaAISettings
type LlamaAISettingsUpdate = Partial<LlamaAISettings>
type StoredLlamaAISettings = Partial<LlamaAISettings> | null

export interface ModelOption {
	id: string
	label: string
}

export interface EffortOption {
	id: string
	label: string
}

export type TipDTO = {
	id: string
	family: string
	variant: string
	title: string
	placement: 'banner' | 'greeting'
	cta:
		| { kind: 'link'; label: string; href: string; external: boolean }
		| { kind: 'action'; label: string; action: string; prompt?: string; payload?: Record<string, unknown> }
		| { kind: 'none' }
	dismissPolicy: { kind: 'permanent' } | { kind: 'snooze'; days: number }
}

export interface SettingsQueryResult {
	settings: StoredLlamaAISettings
	availableModels: Array<ModelOption>
	availableEfforts: Array<EffortOption>
	telegramStatus: TelegramStatus | null
	tip: TipDTO | null
}

const EMPTY_MODEL_OPTIONS: Array<ModelOption> = []
const EMPTY_EFFORT_OPTIONS: Array<EffortOption> = []

const DEFAULT_SETTINGS: LlamaAISettings = {
	customInstructions: '',
	enableMemory: true,
	enablePremiumTools: true,
	hackerMode: false,
	model: '',
	effort: '',
	enableSoundNotifications: true,
	enterToSend: true,
	advancedProvenance: false,
	spendCapPerMessage: LLAMA_AI_SPEND_CAP_DEFAULT
}

function normalizeSpendCap(value: number): number {
	if (!Number.isFinite(value) || value < 0) return LLAMA_AI_SPEND_CAP_DEFAULT
	return value
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const parseTrueByDefault = (value: string | null) => value !== 'false'
const parseFalseByDefault = (value: string | null) => value === 'true'

interface StoredSettingDefinition<Value> {
	storageKey: string
	fallback: string
	parse: (value: string | null) => Value
	write: (value: Value) => void
}

type LlamaAISettingDefinitions = {
	[K in LlamaAISettingKey]: StoredSettingDefinition<LlamaAISettings[K]>
}

const SETTING_DEFINITIONS: LlamaAISettingDefinitions = {
	customInstructions: {
		storageKey: LLAMA_AI_CUSTOM_INSTRUCTIONS_KEY,
		fallback: DEFAULT_SETTINGS.customInstructions,
		parse: (value) => value ?? DEFAULT_SETTINGS.customInstructions,
		write: (value) => {
			const nextValue = value.trim()
			if (nextValue.length === 0) {
				removeStorageItem(LLAMA_AI_CUSTOM_INSTRUCTIONS_KEY)
			} else {
				setStorageItem(LLAMA_AI_CUSTOM_INSTRUCTIONS_KEY, nextValue)
			}
		}
	},
	enableMemory: {
		storageKey: LLAMA_AI_ENABLE_MEMORY_KEY,
		fallback: String(DEFAULT_SETTINGS.enableMemory),
		parse: parseTrueByDefault,
		write: (value) => setStorageItem(LLAMA_AI_ENABLE_MEMORY_KEY, String(value))
	},
	enablePremiumTools: {
		storageKey: LLAMA_AI_ENABLE_PREMIUM_TOOLS_KEY,
		fallback: String(DEFAULT_SETTINGS.enablePremiumTools),
		parse: parseTrueByDefault,
		write: (value) => setStorageItem(LLAMA_AI_ENABLE_PREMIUM_TOOLS_KEY, String(value))
	},
	hackerMode: {
		storageKey: LLAMA_AI_HACKER_MODE_KEY,
		fallback: String(DEFAULT_SETTINGS.hackerMode),
		parse: parseFalseByDefault,
		write: (value) => setStorageItem(LLAMA_AI_HACKER_MODE_KEY, String(value))
	},
	model: {
		storageKey: LLAMA_AI_MODEL_KEY,
		fallback: DEFAULT_SETTINGS.model,
		parse: (value) => value ?? DEFAULT_SETTINGS.model,
		write: (value) => {
			const nextValue = value.trim()
			if (nextValue.length === 0) {
				removeStorageItem(LLAMA_AI_MODEL_KEY)
			} else {
				setStorageItem(LLAMA_AI_MODEL_KEY, nextValue)
			}
		}
	},
	effort: {
		storageKey: LLAMA_AI_EFFORT_KEY,
		fallback: DEFAULT_SETTINGS.effort,
		parse: (value) => value ?? DEFAULT_SETTINGS.effort,
		write: (value) => {
			const nextValue = value.trim()
			if (nextValue.length === 0) {
				removeStorageItem(LLAMA_AI_EFFORT_KEY)
			} else {
				setStorageItem(LLAMA_AI_EFFORT_KEY, nextValue)
			}
		}
	},
	enableSoundNotifications: {
		storageKey: LLAMA_AI_ENABLE_SOUND_KEY,
		fallback: String(DEFAULT_SETTINGS.enableSoundNotifications),
		parse: parseTrueByDefault,
		write: (value) => setStorageItem(LLAMA_AI_ENABLE_SOUND_KEY, String(value))
	},
	enterToSend: {
		storageKey: LLAMA_AI_ENTER_TO_SEND_KEY,
		fallback: String(DEFAULT_SETTINGS.enterToSend),
		parse: parseTrueByDefault,
		write: (value) => setStorageItem(LLAMA_AI_ENTER_TO_SEND_KEY, String(value))
	},
	advancedProvenance: {
		storageKey: LLAMA_AI_ADVANCED_PROVENANCE_KEY,
		fallback: String(DEFAULT_SETTINGS.advancedProvenance),
		parse: parseFalseByDefault,
		write: (value) => setStorageItem(LLAMA_AI_ADVANCED_PROVENANCE_KEY, String(value))
	},
	spendCapPerMessage: {
		storageKey: LLAMA_AI_SPEND_CAP_KEY,
		fallback: String(DEFAULT_SETTINGS.spendCapPerMessage),
		parse: (value) => normalizeSpendCap(value == null ? NaN : Number(value)),
		write: (value) => setStorageItem(LLAMA_AI_SPEND_CAP_KEY, String(normalizeSpendCap(value)))
	}
}

function isEffortAvailableForModel(effort: string, model: string) {
	const isClaude = model === '' || model.startsWith('anthropic/')
	if (isClaude) return effort !== 'minimal'
	if (model.startsWith('openai/')) return effort !== 'max'
	return true
}

function applyStoredSettings(update: LlamaAISettingsUpdate) {
	if (update.customInstructions !== undefined) SETTING_DEFINITIONS.customInstructions.write(update.customInstructions)
	if (update.enableMemory !== undefined) SETTING_DEFINITIONS.enableMemory.write(update.enableMemory)
	if (update.enablePremiumTools !== undefined) SETTING_DEFINITIONS.enablePremiumTools.write(update.enablePremiumTools)
	if (update.hackerMode !== undefined) SETTING_DEFINITIONS.hackerMode.write(update.hackerMode)
	if (update.model !== undefined) SETTING_DEFINITIONS.model.write(update.model)
	if (update.effort !== undefined) SETTING_DEFINITIONS.effort.write(update.effort)
	if (update.enableSoundNotifications !== undefined)
		SETTING_DEFINITIONS.enableSoundNotifications.write(update.enableSoundNotifications)
	if (update.enterToSend !== undefined) SETTING_DEFINITIONS.enterToSend.write(update.enterToSend)
	if (update.advancedProvenance !== undefined) SETTING_DEFINITIONS.advancedProvenance.write(update.advancedProvenance)
	if (update.spendCapPerMessage !== undefined) SETTING_DEFINITIONS.spendCapPerMessage.write(update.spendCapPerMessage)
}

function mergeDefinedSettings(base: StoredLlamaAISettings, incoming: LlamaAISettingsUpdate): StoredLlamaAISettings {
	const merged: LlamaAISettingsUpdate = { ...base }
	if (incoming.customInstructions !== undefined) merged.customInstructions = incoming.customInstructions
	if (incoming.enableMemory !== undefined) merged.enableMemory = incoming.enableMemory
	if (incoming.enablePremiumTools !== undefined) merged.enablePremiumTools = incoming.enablePremiumTools
	if (incoming.hackerMode !== undefined) merged.hackerMode = incoming.hackerMode
	if (incoming.model !== undefined) merged.model = incoming.model
	if (incoming.effort !== undefined) merged.effort = incoming.effort
	if (incoming.enableSoundNotifications !== undefined)
		merged.enableSoundNotifications = incoming.enableSoundNotifications
	if (incoming.enterToSend !== undefined) merged.enterToSend = incoming.enterToSend
	if (incoming.advancedProvenance !== undefined) merged.advancedProvenance = incoming.advancedProvenance
	if (incoming.spendCapPerMessage !== undefined) merged.spendCapPerMessage = incoming.spendCapPerMessage
	return merged
}

function getFailedSettingsRollback(
	current: StoredLlamaAISettings,
	attempted: LlamaAISettingsUpdate,
	previous: LlamaAISettings
): LlamaAISettingsUpdate {
	const rollback: LlamaAISettingsUpdate = {}
	if (attempted.enableMemory !== undefined && current?.enableMemory === attempted.enableMemory)
		rollback.enableMemory = previous.enableMemory
	if (attempted.enablePremiumTools !== undefined && current?.enablePremiumTools === attempted.enablePremiumTools)
		rollback.enablePremiumTools = previous.enablePremiumTools
	if (attempted.hackerMode !== undefined && current?.hackerMode === attempted.hackerMode)
		rollback.hackerMode = previous.hackerMode
	if (attempted.model !== undefined && current?.model === attempted.model) rollback.model = previous.model
	if (attempted.effort !== undefined && current?.effort === attempted.effort) rollback.effort = previous.effort
	if (
		attempted.enableSoundNotifications !== undefined &&
		current?.enableSoundNotifications === attempted.enableSoundNotifications
	)
		rollback.enableSoundNotifications = previous.enableSoundNotifications
	if (attempted.enterToSend !== undefined && current?.enterToSend === attempted.enterToSend)
		rollback.enterToSend = previous.enterToSend
	if (attempted.advancedProvenance !== undefined && current?.advancedProvenance === attempted.advancedProvenance)
		rollback.advancedProvenance = previous.advancedProvenance
	if (attempted.spendCapPerMessage !== undefined && current?.spendCapPerMessage === attempted.spendCapPerMessage)
		rollback.spendCapPerMessage = previous.spendCapPerMessage
	return rollback
}

function normalizeServerSettings(value: unknown): LlamaAISettingsUpdate {
	if (!isRecord(value)) return {}

	const normalized: LlamaAISettingsUpdate = {}
	if (typeof value.customInstructions === 'string') {
		normalized.customInstructions = value.customInstructions
	}
	if (typeof value.enableMemory === 'boolean') {
		normalized.enableMemory = value.enableMemory
	}
	if (typeof value.enablePremiumTools === 'boolean') {
		normalized.enablePremiumTools = value.enablePremiumTools
	}
	if (typeof value.hackerMode === 'boolean') {
		normalized.hackerMode = value.hackerMode
	}
	if (typeof value.model === 'string') {
		normalized.model = value.model
	} else if (typeof value.modelOverride === 'string') {
		normalized.model = value.modelOverride
	}
	if (typeof value.effort === 'string') {
		normalized.effort = value.effort
	} else if (typeof value.effortOverride === 'string') {
		normalized.effort = value.effortOverride
	}
	if (typeof value.enableSoundNotifications === 'boolean') {
		normalized.enableSoundNotifications = value.enableSoundNotifications
	}
	if (typeof value.enterToSend === 'boolean') {
		normalized.enterToSend = value.enterToSend
	}
	if (typeof value.advancedProvenance === 'boolean') {
		normalized.advancedProvenance = value.advancedProvenance
	}
	if (typeof value.spendCapPerMessage === 'number') {
		normalized.spendCapPerMessage = normalizeSpendCap(value.spendCapPerMessage)
	}
	return normalized
}

export function useLlamaAISetting<K extends LlamaAISettingKey>(key: K): LlamaAISettings[K] {
	const definition = SETTING_DEFINITIONS[key]
	const rawValue = useStorageItem(definition.storageKey, definition.fallback)
	return definition.parse(rawValue)
}

export function useAdvancedProvenance(): boolean {
	const { user } = useAuthContext()
	const isLlama = !!user?.flags?.is_llama
	const stored = useStorageItem(LLAMA_AI_ADVANCED_PROVENANCE_KEY, null)
	return stored == null ? isLlama : stored === 'true'
}

// Throws from outside the try's own body, and reads through the optional chain outside the catch:
// the compiler can lower neither in place.
function assertSettingsPersisted(response: Response | null) {
	if (!response?.ok) throw new Error('Failed to persist LlamaAI settings')
}

function settingsOf(latest: SettingsQueryResult | undefined) {
	return latest?.settings ?? null
}

export function useLlamaAISettings() {
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()
	const queryClient = useQueryClient()
	const userId = user?.id ?? null

	const customInstructions = useLlamaAISetting('customInstructions')
	const enableMemory = useLlamaAISetting('enableMemory')
	const enablePremiumTools = useLlamaAISetting('enablePremiumTools')
	const hackerMode = useLlamaAISetting('hackerMode')
	const model = useLlamaAISetting('model')
	const effort = useLlamaAISetting('effort')
	const enableSoundNotifications = useLlamaAISetting('enableSoundNotifications')
	const enterToSend = useLlamaAISetting('enterToSend')
	const spendCapPerMessage = useLlamaAISetting('spendCapPerMessage')

	const advancedProvenance = useAdvancedProvenance()
	const storedSettings: LlamaAISettings = {
		customInstructions,
		enableMemory,
		enablePremiumTools,
		hackerMode,
		model,
		effort,
		enableSoundNotifications,
		enterToSend,
		advancedProvenance,
		spendCapPerMessage
	}
	const settingsQuery = useQuery({
		queryKey: [...LLAMA_AI_SETTINGS_QUERY_KEY, userId],
		queryFn: async (): Promise<SettingsQueryResult> => {
			if (!authorizedFetch || !isAuthenticated || !userId) {
				return {
					settings: null,
					availableModels: EMPTY_MODEL_OPTIONS,
					availableEfforts: EMPTY_EFFORT_OPTIONS,
					telegramStatus: null,
					tip: null
				}
			}
			const response = await authorizedFetch(`${AI_SERVER}/user-settings`)
			if (!response?.ok)
				return {
					settings: null,
					availableModels: EMPTY_MODEL_OPTIONS,
					availableEfforts: EMPTY_EFFORT_OPTIONS,
					telegramStatus: null,
					tip: null
				}
			const data = (await response.json().catch(() => null)) as {
				settings?: unknown
				availableModels?: Array<ModelOption>
				availableEfforts?: Array<EffortOption>
				telegramStatus?: TelegramStatus | null
				tip?: TipDTO | null
			} | null
			return {
				settings: normalizeServerSettings(data?.settings),
				availableModels: Array.isArray(data?.availableModels) ? data.availableModels : EMPTY_MODEL_OPTIONS,
				availableEfforts: Array.isArray(data?.availableEfforts) ? data.availableEfforts : EMPTY_EFFORT_OPTIONS,
				telegramStatus: data?.telegramStatus ?? null,
				tip: data?.tip ?? null
			}
		},
		enabled: isAuthenticated && !!userId,
		staleTime: 5 * 60 * 1000
	})

	useEffect(() => {
		if (!settingsQuery.data?.settings) return
		applyStoredSettings(settingsQuery.data.settings)
	}, [settingsQuery.data?.settings])

	useEffect(() => {
		if (userId) return
		queryClient.removeQueries({ queryKey: [...LLAMA_AI_SETTINGS_QUERY_KEY] })
	}, [queryClient, userId])

	const applySettingsUpdate = (update: LlamaAISettingsUpdate) => {
		applyStoredSettings(update)
		queryClient.setQueryData<SettingsQueryResult>([...LLAMA_AI_SETTINGS_QUERY_KEY, userId], (previous) => ({
			settings: mergeDefinedSettings(previous?.settings ?? null, update),
			availableModels: previous?.availableModels ?? EMPTY_MODEL_OPTIONS,
			availableEfforts: previous?.availableEfforts ?? EMPTY_EFFORT_OPTIONS,
			telegramStatus: previous?.telegramStatus ?? null,
			tip: previous?.tip ?? null
		}))
	}

	const persistSettingsMutation = useMutation({
		scope: { id: `llama-ai-settings:${userId ?? 'local'}` },
		mutationFn: async (update: LlamaAISettingsUpdate) => {
			if (!authorizedFetch || !isAuthenticated || !userId) return update
			const queryKey = [...LLAMA_AI_SETTINGS_QUERY_KEY, userId]
			await queryClient.cancelQueries({ queryKey })
			const current = queryClient.getQueryData<SettingsQueryResult>(queryKey)
			const previousSettings = { ...storedSettings, ...current?.settings }
			const optimisticUpdate = { ...update }
			delete optimisticUpdate.customInstructions
			applySettingsUpdate(optimisticUpdate)

			try {
				const response = await authorizedFetch(`${AI_SERVER}/user-settings`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ settings: update })
				})
				assertSettingsPersisted(response)
			} catch (error) {
				const latest = queryClient.getQueryData<SettingsQueryResult>(queryKey)
				applySettingsUpdate(getFailedSettingsRollback(settingsOf(latest), optimisticUpdate, previousSettings))
				throw error
			}
			return update
		},
		onSuccess: ({ customInstructions: savedCustomInstructions }) => {
			if (savedCustomInstructions !== undefined) {
				applySettingsUpdate({ customInstructions: savedCustomInstructions })
			}
		},
		onError: (error) => {
			console.error('[llama-ai] failed to persist settings:', getErrorMessage(error))
			toast.error('Could not save AI settings. Please try again.')
		}
	})

	const persistSettings = useCallback(
		async (update: LlamaAISettingsUpdate) => {
			if (!isAuthenticated || !userId) {
				applyStoredSettings(update)
				return true
			}
			try {
				await persistSettingsMutation.mutateAsync(update)
				return true
			} catch {
				return false
			}
		},
		[isAuthenticated, persistSettingsMutation, userId]
	)

	const actions = useMemo<LlamaAISettingsActions>(
		() => ({
			setCustomInstructions: (value) => persistSettings({ customInstructions: value.trim() }),
			setEnableMemory: (value) => persistSettings({ enableMemory: value }),
			setEnablePremiumTools: (value) => persistSettings({ enablePremiumTools: value }),
			setHackerMode: (value) => persistSettings({ hackerMode: value }),
			setModel: (value) => persistSettings({ model: value }),
			setEffort: (value) => persistSettings({ effort: value }),
			setEnableSoundNotifications: (value) => persistSettings({ enableSoundNotifications: value }),
			setEnterToSend: (value) => persistSettings({ enterToSend: value }),
			setAdvancedProvenance: (value) => persistSettings({ advancedProvenance: value }),
			setSpendCapPerMessage: (value) => persistSettings({ spendCapPerMessage: normalizeSpendCap(value) })
		}),
		[persistSettings]
	)

	const availableModels = settingsQuery.data?.availableModels ?? EMPTY_MODEL_OPTIONS
	const availableEfforts = settingsQuery.data?.availableEfforts ?? EMPTY_EFFORT_OPTIONS

	const settings = useMemo<LlamaAISettings>(() => {
		const normalizedModel =
			model === '' || availableModels.length === 0 || availableModels.some((m) => m.id === model) ? model : ''
		const normalizedEffort =
			effort === '' ||
			(availableEfforts.length > 0 &&
				availableEfforts.some((e) => e.id === effort) &&
				isEffortAvailableForModel(effort, normalizedModel))
				? effort
				: ''
		return {
			customInstructions,
			enableMemory,
			enablePremiumTools,
			hackerMode,
			model: normalizedModel,
			effort: normalizedEffort,
			enableSoundNotifications,
			enterToSend,
			advancedProvenance,
			spendCapPerMessage
		}
	}, [
		customInstructions,
		enableMemory,
		enablePremiumTools,
		hackerMode,
		model,
		availableModels,
		effort,
		availableEfforts,
		enableSoundNotifications,
		enterToSend,
		advancedProvenance,
		spendCapPerMessage
	])

	return {
		settings,
		actions,
		availableModels,
		availableEfforts,
		tip: settingsQuery.data?.tip ?? null,
		telegramStatus: settingsQuery.data?.telegramStatus ?? null,
		queryState: settingsQuery
	}
}
