import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import pb from '~/utils/pocketbase'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { AIGeneratedData, CustomTimePeriod, Dashboard, TimePeriod } from '../dashboardTypes'
import { buildDashboardSaveRequest } from '../services/DashboardAPI'

interface UseAutoSaveOptions {
	dashboardId: string | null
	dashboardName: string
	dashboardVisibility: 'private' | 'public'
	dashboardTags: Array<string>
	dashboardDescription: string
	timePeriod: TimePeriod
	customTimePeriod: CustomTimePeriod | null
	isAuthenticated: boolean
	isReadOnly: boolean
	currentDashboard: { user?: string; aiGenerated?: AIGeneratedData | null } | null
	userId: string | undefined
	updateDashboard: (params: {
		id: string
		data: {
			items: Array<DashboardItemConfig>
			dashboardName: string
			timePeriod?: TimePeriod
			customTimePeriod?: CustomTimePeriod | null
			visibility: 'private' | 'public'
			tags: Array<string>
			description: string
			aiGenerated?: AIGeneratedData | null
		}
	}) => Promise<Dashboard>
	toPersistedDashboardItems: (items: Array<DashboardItemConfig>) => Array<DashboardItemConfig>
	isFreeUser: boolean
	mode?: 'view' | 'edit'
	delay?: number
}

interface AutoSaveOverrides {
	timePeriod?: TimePeriod
	customTimePeriod?: CustomTimePeriod | null
}

interface PendingSaveData {
	dashboardId: string
	data: {
		items: Array<DashboardItemConfig>
		dashboardName: string
		timePeriod?: TimePeriod
		customTimePeriod?: CustomTimePeriod | null
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		aiGenerated?: AIGeneratedData | null
	}
}

export function useAutoSave(options: UseAutoSaveOptions) {
	const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	// Read by the debounce timer and the flush handler, which run outside render.
	const optionsRef = useRef(options)
	useLayoutEffect(() => {
		optionsRef.current = options
	})

	const pendingDataRef = useRef<PendingSaveData | null>(null)

	// useEffectEvent ensures we always call the latest flush logic without re-subscribing listeners
	const onFlushPendingSave = useEffectEvent(() => {
		if (autoSaveTimeoutRef.current) {
			clearTimeout(autoSaveTimeoutRef.current)
			autoSaveTimeoutRef.current = null
		}

		const pending = pendingDataRef.current
		const token = pb.authStore.token

		if (pending && token) {
			const { url, options: requestOptions } = buildDashboardSaveRequest({
				id: pending.dashboardId,
				data: pending.data
			})
			void fetch(url, {
				...requestOptions,
				headers: {
					...requestOptions.headers,
					Authorization: `Bearer ${token}`
				},
				keepalive: true
			})
			pendingDataRef.current = null
		}
	})

	useEffect(() => {
		const handlePageHide = () => onFlushPendingSave()
		const handleBeforeUnload = () => onFlushPendingSave()
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				onFlushPendingSave()
			}
		}

		window.addEventListener('pagehide', handlePageHide)
		window.addEventListener('beforeunload', handleBeforeUnload)
		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			onFlushPendingSave()
			window.removeEventListener('pagehide', handlePageHide)
			window.removeEventListener('beforeunload', handleBeforeUnload)
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [])

	const autoSave = useCallback((newItems: Array<DashboardItemConfig>, overrides?: AutoSaveOverrides) => {
		const {
			dashboardId,
			isAuthenticated,
			isReadOnly,
			currentDashboard,
			userId,
			dashboardName,
			dashboardVisibility,
			dashboardTags,
			dashboardDescription,
			timePeriod,
			customTimePeriod,
			toPersistedDashboardItems,
			updateDashboard,
			isFreeUser,
			mode = 'edit',
			delay = 800
		} = optionsRef.current

		const isOwner = currentDashboard && userId && currentDashboard.user === userId
		const shouldBlock = mode === 'view' || !dashboardId || !isAuthenticated || isReadOnly || !isOwner

		if (shouldBlock) {
			return
		}

		if (autoSaveTimeoutRef.current) {
			clearTimeout(autoSaveTimeoutRef.current)
		}

		const cleanedItems = toPersistedDashboardItems(newItems)
		const data = {
			items: cleanedItems,
			dashboardName,
			timePeriod: overrides?.timePeriod ?? timePeriod,
			customTimePeriod: overrides?.customTimePeriod !== undefined ? overrides.customTimePeriod : customTimePeriod,
			visibility: isFreeUser ? 'public' : dashboardVisibility,
			tags: dashboardTags,
			description: dashboardDescription,
			aiGenerated: currentDashboard?.aiGenerated ?? null
		}

		pendingDataRef.current = { dashboardId, data }

		autoSaveTimeoutRef.current = setTimeout(() => {
			updateDashboard({ id: dashboardId, data })
				.then((savedDashboard) => {
					pendingDataRef.current = null
					if (savedDashboard?.artifactActivationPending) {
						toast.error('Dashboard saved, but chart refresh setup is pending.')
					}
				})
				.catch((error) => {
					console.log('Auto-save failed:', error)
				})
		}, delay)
	}, [])

	const clearAutoSave = useCallback(() => {
		if (autoSaveTimeoutRef.current) {
			clearTimeout(autoSaveTimeoutRef.current)
			autoSaveTimeoutRef.current = null
		}
	}, [])

	return {
		autoSave,
		clearAutoSave
	}
}
