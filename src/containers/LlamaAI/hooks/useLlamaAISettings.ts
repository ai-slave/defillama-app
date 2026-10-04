import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { LLAMA_AI_CUSTOM_INSTRUCTIONS_KEY } from '~/containers/LlamaAI/customInstructionsStorage'
import { removeStorageItem, setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { getErrorMessage } from '~/utils/error'
import pb from '~/utils/pocketbase'

export const LLAMA_AI_ENABLE_MEMORY_KEY = 'llamaai-enable-memory'
export const LLAMA_AI_ENABLE_PREMIUM_TOOLS_KEY = 'llamaai-enable-premium-tools'
export const LLAMA_AI_HACKER_MODE_KEY = 'llamaai-hacker-mode'
export const LLAMA_AI_MODEL_KEY = 'llamaai-model'
export const LLAMA_AI_EFFORT_KEY = 'llamaai-effort'
export const LLAMA_AI_ENABLE_SOUND_KEY = 'llamaai-enable-sound'
export const LLAMA_AI_ENTER_TO_SEND_KEY = 'llamaai-enter-to-send'
export const LLAMA_AI_ADVANCED_PROVENANCE_KEY = 'llamaai-advanced-provenance'
export const LLAMA_AI_SHOW_BALANCE_IN_SIDEBAR_KEY = 'llamaai-show-balance-in-sidebar'
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
	showBalanceInSidebar: boolean
	spendCapPerMessage: number
}

type LlamaAISettingKey = keyof LlamaAISettings
export type LlamaAISettingsUpdate = Partial<LlamaAISettings>
/** Saves the given settings; resolves false when the server refuses them. */
export type SaveLlamaAISettings = (update: LlamaAISettingsUpdate) => Promise<boolean>
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
	showBalanceInSidebar: false,
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
	showBalanceInSidebar: {
		storageKey: LLAMA_AI_SHOW_BALANCE_IN_SIDEBAR_KEY,
		fallback: String(DEFAULT_SETTINGS.showBalanceInSidebar),
		parse: parseFalseByDefault,
		write: (value) => setStorageItem(LLAMA_AI_SHOW_BALANCE_IN_SIDEBAR_KEY, String(value))
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

function writeStoredSetting<K extends LlamaAISettingKey>(key: K, value: LlamaAISettings[K]) {
	SETTING_DEFINITIONS[key].write(value)
}

function applyStoredSettings(update: LlamaAISettingsUpdate) {
	for (const key in update) {
		const settingKey = key as LlamaAISettingKey
		writeStoredSetting(settingKey, update[settingKey]!)
	}
}

/** The previous value of each attempted setting that still shows the attempt, so a refused save undoes only itself. */
function getFailedSettingsRollback(
	current: StoredLlamaAISettings,
	attempted: LlamaAISettingsUpdate,
	previous: LlamaAISettings
): LlamaAISettingsUpdate {
	const rollback: Record<string, unknown> = {}
	for (const key in attempted) {
		const settingKey = key as LlamaAISettingKey
		if (current?.[settingKey] === attempted[settingKey]) rollback[key] = previous[settingKey]
	}
	return rollback as LlamaAISettingsUpdate
}

// The server's settings are untyped JSON: keep only values of each setting's type.
function normalizeServerSettings(value: unknown): LlamaAISettingsUpdate {
	if (!isRecord(value)) return {}
	const normalized: Record<string, unknown> = {}
	for (const key in DEFAULT_SETTINGS) {
		if (typeof value[key] === typeof DEFAULT_SETTINGS[key as LlamaAISettingKey]) normalized[key] = value[key]
	}
	if (normalized.model === undefined && typeof value.modelOverride === 'string') normalized.model = value.modelOverride
	if (normalized.effort === undefined && typeof value.effortOverride === 'string')
		normalized.effort = value.effortOverride
	if (typeof normalized.spendCapPerMessage === 'number') {
		normalized.spendCapPerMessage = normalizeSpendCap(normalized.spendCapPerMessage)
	}
	return normalized as LlamaAISettingsUpdate
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

// Throws from outside the try's own body: the compiler cannot lower a throw inside try/catch.
function assertSettingsPersisted(response: Response | null) {
	if (!response?.ok) throw new Error('Failed to persist LlamaAI settings')
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
	const showBalanceInSidebar = useLlamaAISetting('showBalanceInSidebar')
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
		showBalanceInSidebar,
		spendCapPerMessage
	}
	const settingsQuery = useQuery({
		queryKey: [...LLAMA_AI_SETTINGS_QUERY_KEY, userId],
		queryFn: async (): Promise<SettingsQueryResult> => {
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

	const applySettingsUpdate = (update: LlamaAISettingsUpdate) => {
		applyStoredSettings(update)
		queryClient.setQueryData<SettingsQueryResult>([...LLAMA_AI_SETTINGS_QUERY_KEY, userId], (previous) => ({
			settings: { ...previous?.settings, ...update },
			availableModels: previous?.availableModels ?? EMPTY_MODEL_OPTIONS,
			availableEfforts: previous?.availableEfforts ?? EMPTY_EFFORT_OPTIONS,
			telegramStatus: previous?.telegramStatus ?? null,
			tip: previous?.tip ?? null
		}))
	}

	const persistSettingsMutation = useMutation({
		scope: { id: `llama-ai-settings:${userId ?? 'local'}` },
		mutationFn: async (update: LlamaAISettingsUpdate) => {
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
				applySettingsUpdate(getFailedSettingsRollback(latest?.settings ?? null, optimisticUpdate, previousSettings))
				throw error
			}
			// Written here, not in onSuccess: TanStack hands a pending save each render's new options, so onSuccess
			// would see whoever signed in meanwhile, while this closure keeps the account that submitted the save.
			// A save that lands after logout or an account switch must not write that account's text back.
			if (update.customInstructions !== undefined && pb.authStore.record?.id === userId) {
				applySettingsUpdate({ customInstructions: update.customInstructions })
			}
			return update
		},
		onError: (error) => {
			// SettingsModal, the only caller, reports the failure in the dialog.
			console.error('[llama-ai] failed to persist settings:', getErrorMessage(error))
		}
	})

	const saveSettings: SaveLlamaAISettings = useCallback(
		async (update) => {
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

	const availableModels = settingsQuery.data?.availableModels ?? EMPTY_MODEL_OPTIONS
	const availableEfforts = settingsQuery.data?.availableEfforts ?? EMPTY_EFFORT_OPTIONS

	const settings = useMemo<LlamaAISettings>(() => {
		const normalizedModel =
			model === '' || availableModels.length === 0 || availableModels.some((m) => m.id === model) ? model : ''
		const normalizedEffort =
			effort === '' ||
			(availableEfforts.some((e) => e.id === effort) && isEffortAvailableForModel(effort, normalizedModel))
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
			showBalanceInSidebar,
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
		showBalanceInSidebar,
		spendCapPerMessage
	])

	return {
		settings,
		saveSettings,
		availableModels,
		availableEfforts,
		tip: settingsQuery.data?.tip ?? null,
		telegramStatus: settingsQuery.data?.telegramStatus ?? null,
		queryState: settingsQuery
	}
}
