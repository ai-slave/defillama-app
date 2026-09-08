import { type MutationState, useIsMutating, useMutationState, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { CustomTimePeriod, Dashboard, TimePeriod } from '../dashboardTypes'
import { toDashboardSavePayload } from '../utils/dashboardUtils'
import { type DashboardUpdate, useUpdateDashboard, wasDashboardDeleted } from './useDashboardAPI'

export function useAutoSave({
	dashboard,
	enabled,
	isFreeUser,
	timePeriod,
	customTimePeriod,
	delay = 800
}: {
	dashboard: Dashboard | null
	enabled: boolean
	isFreeUser: boolean
	timePeriod: TimePeriod
	customTimePeriod: CustomTimePeriod | null
	delay?: number
}) {
	const client = useQueryClient()
	const { user } = useAuthContext()
	const mutationKey = useMemo(
		() => ['pro-dashboard-update', dashboard?.id ?? null, user?.id],
		[dashboard?.id, user?.id]
	)
	const { mutate: save } = useUpdateDashboard(dashboard?.id ?? null, 'autosave')
	const attempts = useMutationState({
		filters: {
			mutationKey,
			predicate: (mutation) => (mutation.state.variables as DashboardUpdate | undefined)?.source === 'autosave'
		},
		select: (mutation) => mutation.state as MutationState<Dashboard, Error, DashboardUpdate>
	})
	const state = attempts.at(-1)
	const saving = useIsMutating({ mutationKey }) > 0
	const [queued, setQueued] = useState<DashboardUpdate | null>(null)
	// Timer, manual save, and page lifecycle events may flush the same render before React commits.
	const flushedRef = useRef<DashboardUpdate | null>(null)
	const flush = useCallback(() => {
		if (!queued || flushedRef.current === queued) return flushedRef.current ?? state?.variables ?? null
		if (wasDashboardDeleted(client, queued.id, user?.id)) {
			setQueued(null)
			return null
		}
		flushedRef.current = queued
		setQueued((current) => (current === queued ? null : current))
		save(queued)
		return queued
	}, [queued, save, state?.variables, client, user?.id])

	const onFlush = useEffectEvent(() => flush())
	const onUnmount = useEffectEvent(() => {
		flush()
		for (const mutation of client.getMutationCache().findAll({ mutationKey })) {
			if (
				(mutation.state.variables as DashboardUpdate | undefined)?.source === 'autosave' &&
				mutation.state.status === 'success'
			) {
				client.getMutationCache().remove(mutation)
			}
		}
	})
	useEffect(() => {
		if (!queued) return
		const timer = setTimeout(() => onFlush(), delay)
		return () => clearTimeout(timer)
	}, [queued, delay])

	useEffect(() => {
		const hide = () => onFlush()
		const visibility = () => {
			if (document.visibilityState === 'hidden') onFlush()
		}
		window.addEventListener('pagehide', hide)
		document.addEventListener('visibilitychange', visibility)
		return () => {
			onUnmount()
			window.removeEventListener('pagehide', hide)
			document.removeEventListener('visibilitychange', visibility)
		}
	}, [])

	const unsaved = queued !== null
	useEffect(() => {
		if (!unsaved) return
		const warn = (event: BeforeUnloadEvent) => {
			onFlush()
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', warn)
		return () => window.removeEventListener('beforeunload', warn)
	}, [unsaved])

	const autoSave = useCallback(
		(items: Array<DashboardItemConfig>) => {
			if (!enabled || !dashboard) return
			setQueued({
				id: dashboard.id,
				source: 'autosave',
				data: toDashboardSavePayload(dashboard),
				changes: {
					items,
					timePeriod,
					customTimePeriod,
					...(isFreeUser ? { visibility: 'public' as const } : {})
				}
			})
		},
		[enabled, dashboard, timePeriod, customTimePeriod, isFreeUser]
	)

	const acknowledge = useCallback(
		(request: DashboardUpdate | null) => {
			// A manual save includes earlier local edits, but must not clear feedback for a later edit.
			if (!request) return
			for (const mutation of client.getMutationCache().findAll({ mutationKey })) {
				if (mutation.state.variables === request) client.getMutationCache().remove(mutation)
			}
		},
		[client, mutationKey]
	)
	const retry = () => {
		if (client.isMutating({ mutationKey })) return
		if (queued) flush()
		else if (state?.status === 'error' && state.variables) {
			const request = { ...state.variables }
			flushedRef.current = request
			save(request)
		}
	}
	return { autoSave, flush, acknowledge, queued, state, retry, saving }
}
