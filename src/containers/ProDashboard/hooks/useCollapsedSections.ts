import { useCallback, useMemo } from 'react'
import { getStorageJSON, setStorageJSON, useStorageItem } from '~/contexts/localStorageStore'
import type { SectionConfig } from '../types'

const STORAGE_PREFIX = 'pro-dashboard-collapsed:'

function storageKey(dashboardId: string | null) {
	return `${STORAGE_PREFIX}${dashboardId ?? 'draft'}`
}

function parseCollapsed(raw: string | null): Record<string, boolean> {
	if (!raw) return {}
	try {
		const parsed: unknown = JSON.parse(raw)
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, boolean>) : {}
	} catch {
		return {}
	}
}

export function useCollapsedSections(dashboardId: string | null) {
	const key = storageKey(dashboardId)
	const raw = useStorageItem(key, null)
	const overrides = useMemo(() => parseCollapsed(raw), [raw])
	const isCollapsed = useCallback(
		(section: SectionConfig) => overrides[section.id] ?? section.collapsed === true,
		[overrides]
	)
	const toggle = useCallback(
		(section: SectionConfig) => {
			const current = getStorageJSON<Record<string, boolean>>(key, {})
			const next = { ...current, [section.id]: !(current[section.id] ?? section.collapsed === true) }
			setStorageJSON(key, next)
		},
		[key]
	)
	const expand = useCallback(
		(section: SectionConfig) => {
			const current = getStorageJSON<Record<string, boolean>>(key, {})
			if (!(current[section.id] ?? section.collapsed === true)) return
			setStorageJSON(key, { ...current, [section.id]: false })
		},
		[key]
	)
	return { isCollapsed, toggle, expand }
}
