import { recordDomainEvent, runOutsideRouteTelemetry } from '~/utils/telemetry'
import { hydrateMetadataCache, replaceMetadataCacheContents, validateCoreMetadataPayload } from './artifactContract'
import { loadMetadataArtifactsForBoot } from './artifacts'
import {
	getMetadataCacheMaxAgeMs,
	getMetadataCacheRetryMs,
	getMetadataRuntimeRefreshIntervalMs,
	getMetadataRuntimeRefreshJitterMs,
	shouldStartMetadataRuntimeRefreshLoop
} from './config'
import { fetchCoreMetadata } from './fetch'
import { shouldSkipMetadataRefresh } from './policy'

const bootArtifacts = loadMetadataArtifactsForBoot()
const metadataCache = hydrateMetadataCache(bootArtifacts.payload)

let lastSuccessfulRefreshMs = bootArtifacts.manifest?.status === 'ready' ? bootArtifacts.manifest.pulledAt : 0
let lastAttemptMs = 0
let refreshInFlight: Promise<void> | null = null
let runtimeLoopStarted = false
let scheduledRuntimeRefresh: ReturnType<typeof setTimeout> | null = null

function unrefTimer(timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>): void {
	timer.unref?.()
}

function getRuntimeRefreshJitterDelayMs(): number {
	const jitterMs = getMetadataRuntimeRefreshJitterMs()
	return jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0
}

function isRefreshDue(now: number): boolean {
	if (lastSuccessfulRefreshMs === 0) return true
	return now - lastSuccessfulRefreshMs > getMetadataCacheMaxAgeMs()
}

function isRetrySuppressed(now: number): boolean {
	return lastAttemptMs > 0 && now - lastAttemptMs < getMetadataCacheRetryMs()
}

function recordMetadataRefreshTelemetry({
	durationMs,
	error,
	source,
	staleAgeMs,
	status
}: {
	durationMs: number
	error?: unknown
	source: string
	staleAgeMs: number | undefined
	status: 'failure' | 'success'
}): void {
	const attributes = {
		duration_ms: durationMs,
		source,
		status,
		...(staleAgeMs === undefined ? null : { stale_age_ms: staleAgeMs }),
		...(error instanceof Error
			? { error_message: error.message, error_name: error.name }
			: error === undefined
				? null
				: { error_message: String(error) })
	}

	recordDomainEvent(
		'metadata.refresh',
		status === 'success' ? 'info' : 'warn',
		source,
		status === 'success' ? 'Metadata refresh completed' : 'Metadata refresh failed',
		attributes
	)
}

async function doRefresh(source: string): Promise<void> {
	const startedAt = Date.now()
	const staleAgeMs = lastSuccessfulRefreshMs === 0 ? undefined : startedAt - lastSuccessfulRefreshMs
	try {
		const payload = validateCoreMetadataPayload(await fetchCoreMetadata())
		replaceMetadataCacheContents(metadataCache, payload)
		const now = Date.now()
		lastSuccessfulRefreshMs = now
		lastAttemptMs = now
		recordMetadataRefreshTelemetry({
			durationMs: now - startedAt,
			source,
			staleAgeMs,
			status: 'success'
		})
	} catch (error) {
		const now = Date.now()
		lastAttemptMs = now
		recordMetadataRefreshTelemetry({
			durationMs: now - startedAt,
			error,
			source,
			staleAgeMs,
			status: 'failure'
		})
		console.error(`[metadata] refresh failed from ${source}, keeping stale cache:`, error)
	}
}

/**
 * Start a metadata refresh if stale. Safe to call from concurrent requests:
 * only one refresh runs at a time, and failed refreshes keep the current cache.
 */
function startMetadataRefreshIfStale(source: string): Promise<void> | null {
	// Local contributors without an API key should still be able to boot dev
	// from generated or stub artifacts; affected pages can resolve to 404s.
	if (shouldSkipMetadataRefresh()) {
		return null
	}

	const now = Date.now()
	if (!isRefreshDue(now) || isRetrySuppressed(now)) {
		return null
	}

	if (refreshInFlight !== null) {
		return refreshInFlight
	}

	refreshInFlight = doRefresh(source).finally(() => {
		refreshInFlight = null
	})

	return refreshInFlight
}

function scheduleJitteredRuntimeRefresh(): void {
	if (scheduledRuntimeRefresh !== null) return

	const timer = setTimeout(() => {
		scheduledRuntimeRefresh = null
		void runOutsideRouteTelemetry(() => startMetadataRefreshIfStale('runtime_loop'))
	}, getRuntimeRefreshJitterDelayMs())
	scheduledRuntimeRefresh = timer
	unrefTimer(timer)
}

function runRuntimeRefreshLoopTick(): void {
	const now = Date.now()
	if (!isRefreshDue(now) || isRetrySuppressed(now) || shouldSkipMetadataRefresh()) {
		return
	}
	scheduleJitteredRuntimeRefresh()
}

function startRuntimeRefreshLoop(): void {
	if (runtimeLoopStarted || !shouldStartMetadataRuntimeRefreshLoop()) {
		return
	}
	runtimeLoopStarted = true

	const initialTimer = setTimeout(() => {
		runRuntimeRefreshLoopTick()
		const interval = setInterval(runRuntimeRefreshLoopTick, getMetadataRuntimeRefreshIntervalMs())
		unrefTimer(interval)
	}, getRuntimeRefreshJitterDelayMs())
	unrefTimer(initialTimer)
}

/**
 * Start refreshing stale metadata in the background while callers continue using the current cache.
 */
export function refreshMetadataInBackgroundIfStale(source: string): void {
	void runOutsideRouteTelemetry(() => startMetadataRefreshIfStale(source))
}

startRuntimeRefreshLoop()

export default metadataCache
