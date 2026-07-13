type Listener = () => void

export interface SqlRefreshProgress {
	active: number
	total: number
	failed: number
	bulk: boolean
}

const INITIAL_PROGRESS: SqlRefreshProgress = { active: 0, total: 0, failed: 0, bulk: false }

const listeners = new Set<Listener>()
const progressListeners = new Set<Listener>()
const activeIds = new Set<string>()
let waveTotal = 0
let waveFailed = 0
let waveIsBulk = false
let currentProgress: SqlRefreshProgress = INITIAL_PROGRESS

function notifyProgress(): void {
	currentProgress = { active: activeIds.size, total: waveTotal, failed: waveFailed, bulk: waveIsBulk }
	for (const listener of progressListeners) listener()
}

export function subscribeSqlRefreshAll(listener: Listener): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function refreshAllSqlCharts(): void {
	if (listeners.size > 0) waveIsBulk = true
	for (const listener of listeners) listener()
}

export function subscribeSqlRefreshProgress(listener: Listener): () => void {
	progressListeners.add(listener)
	return () => {
		progressListeners.delete(listener)
	}
}

export function getSqlRefreshProgress(): SqlRefreshProgress {
	return currentProgress
}

export function getInitialSqlRefreshProgress(): SqlRefreshProgress {
	return INITIAL_PROGRESS
}

export function reportSqlRefreshStart(id: string): void {
	if (activeIds.has(id)) return
	if (activeIds.size === 0) {
		waveTotal = 0
		waveFailed = 0
	}
	activeIds.add(id)
	waveTotal++
	notifyProgress()
}

export function reportSqlRefreshEnd(id: string, ok: boolean): void {
	if (!activeIds.delete(id)) return
	if (!ok) waveFailed++
	notifyProgress()
	if (activeIds.size === 0) waveIsBulk = false
}
