import { DATASETS_SERVER_URL, SERVER_URL } from '~/constants'
import { fetchJson, getSlowJsonTimeoutMs } from '~/utils/async'
import type { EmissionEvent, ProtocolEmission, ProtocolEmissionDetail } from './api.types'

const PROTOCOL_EMISSIONS_API = `${SERVER_URL}/emissions`
const PROTOCOL_EMISSIONS_LIST_API = `${DATASETS_SERVER_URL}/emissionsProtocolsList`
const PROTOCOL_EMISSION_API = `${DATASETS_SERVER_URL}/emissions`

type RawEmissionEvent = Omit<EmissionEvent, 'timestamp'> & { timestamp: number | string }
type RawProtocolEmission = Omit<ProtocolEmission, 'events'> & { events?: RawEmissionEvent[] | null }

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProtocolEmissionDetail(value: unknown): value is ProtocolEmissionDetail {
	if (!isObjectRecord(value)) return false
	const obj = value
	return typeof obj.name === 'string' && ('metadata' in obj || 'documentedData' in obj || 'realTimeData' in obj)
}

function parseProtocolEmissionApiResponse(raw: unknown): ProtocolEmissionDetail | null {
	return isProtocolEmissionDetail(raw) ? raw : null
}

/**
 * Fetch emission data for a single protocol
 */
export async function fetchProtocolEmission(protocolName: string): Promise<ProtocolEmissionDetail | null> {
	if (!protocolName) return null
	const encodedProtocolName = encodeURIComponent(protocolName)
	try {
		const raw = await fetchJson<unknown>(`${PROTOCOL_EMISSION_API}/${encodedProtocolName}`)
		return parseProtocolEmissionApiResponse(raw)
	} catch (error) {
		console.error(`Failed to fetch protocol emission for ${protocolName}:`, error)
		return null
	}
}

/**
 * Fetch all protocol emissions data
 */
export async function fetchAllProtocolEmissions(): Promise<ProtocolEmission[]> {
	try {
		const res = await fetchJson<RawProtocolEmission[]>(PROTOCOL_EMISSIONS_API)
		if (!Array.isArray(res)) return []

		// The endpoint is ascending, but a few legacy rows encode the timestamp as
		// a numeric string. Normalize that known boundary mismatch once so all
		// downstream chart/calendar loops keep a strict numeric contract.
		for (const protocol of res) {
			const events = protocol.events
			if (!events) continue

			let writeIndex = 0
			for (const event of events) {
				const timestamp = typeof event.timestamp === 'string' ? Number(event.timestamp) : event.timestamp
				if (!Number.isFinite(timestamp)) continue
				event.timestamp = timestamp
				events[writeIndex++] = event
			}
			events.length = writeIndex
		}

		return res as ProtocolEmission[]
	} catch (error) {
		console.error('Failed to fetch all protocol emissions:', error)
		return []
	}
}

/**
 * Fetch the list of protocol names that have emissions data
 */
export async function fetchEmissionsProtocolsList(options: { timeout?: number } = {}): Promise<string[]> {
	try {
		const res = await fetchJson<string[]>(PROTOCOL_EMISSIONS_LIST_API, {
			timeout: options.timeout ?? getSlowJsonTimeoutMs()
		})
		if (!Array.isArray(res)) return []
		return res
	} catch (error) {
		console.error('Failed to fetch emissions protocols list:', error)
		return []
	}
}
