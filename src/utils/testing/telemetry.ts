import { afterEach, beforeEach, vi } from 'vitest'
import type { TelemetryEvent } from '~/utils/telemetry'
import { installFixtureFetch } from './fixtureFetch'

async function flush() {
	const { flushTelemetry } = await import('~/utils/telemetry')
	await flushTelemetry()
}

/** Capture the actual HTTP telemetry payload, including route context and serialization. */
export function installTelemetrySink() {
	const http = installFixtureFetch()
	const events: Array<TelemetryEvent> = []
	beforeEach(() => {
		events.length = 0
		vi.stubEnv('OPS_TELEMETRY_URL', 'https://telemetry.test/events')
		vi.stubEnv('OPS_TELEMETRY_TOKEN', 'test-token')
		http.serve({
			'https://telemetry.test/events': (_url: URL, init?: RequestInit) => {
				events.push(...JSON.parse(init!.body as string).events)
				return { ok: true }
			}
		})
	})
	afterEach(async () => {
		await flush()
		vi.unstubAllEnvs()
	})
	return {
		...http,
		async events() {
			await flush()
			return events
		}
	}
}
