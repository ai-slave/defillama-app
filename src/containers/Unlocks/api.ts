import { DATASETS_SERVER_URL, SERVER_URL } from '~/constants'
import { fetchJson, getSlowJsonTimeoutMs } from '~/utils/async'
import type { EmissionEvent, ProtocolEmission, ProtocolEmissionDetail } from './api.types'

const PROTOCOL_EMISSIONS_API = `${SERVER_URL}/emissions`
const PROTOCOL_EMISSIONS_LIST_API = `${DATASETS_SERVER_URL}/emissionsProtocolsList`
const PROTOCOL_EMISSION_API = `${DATASETS_SERVER_URL}/emissions`

type RawEmissionEvent = Omit<EmissionEvent, 'timestamp' | 'noOfTokens' | 'hasUnknownTokenAmount'> & {
	timestamp: number | `${number}`
	noOfTokens: Array<number | null>
}
type RawProtocolEmission = ProtocolEmission | (Omit<ProtocolEmission, 'events'> & { events: RawEmissionEvent[] })
type RawProtocolEmissionDetail =
	| ProtocolEmissionDetail
	| (Omit<ProtocolEmissionDetail, 'metadata'> & {
			metadata: Omit<NonNullable<ProtocolEmissionDetail['metadata']>, 'events'> & {
				events: RawEmissionEvent[]
			}
	  })

function hasKnownEmissionAmounts(amounts: Array<number | null>): amounts is number[] {
	for (const amount of amounts) {
		if (amount === null) return false
	}
	return true
}

function isNormalizedEmissionEvent(event: RawEmissionEvent): event is EmissionEvent {
	return typeof event.timestamp === 'number' && hasKnownEmissionAmounts(event.noOfTokens)
}

function areNormalizedEmissionEvents(events: RawEmissionEvent[]): events is EmissionEvent[] {
	for (const event of events) {
		if (!isNormalizedEmissionEvent(event)) return false
	}
	return true
}

function normalizeEmissionEvent(event: RawEmissionEvent): EmissionEvent {
	if (isNormalizedEmissionEvent(event)) return event
	const { timestamp, noOfTokens, ...metadata } = event
	const normalizedTimestamp = typeof timestamp === 'string' ? Number(timestamp) : timestamp
	if (!hasKnownEmissionAmounts(noOfTokens)) {
		return {
			...metadata,
			timestamp: normalizedTimestamp,
			noOfTokens: [],
			hasUnknownTokenAmount: true
		}
	}
	return { ...metadata, timestamp: normalizedTimestamp, noOfTokens }
}

function normalizeEmissionEvents(events: RawEmissionEvent[]): EmissionEvent[] {
	if (areNormalizedEmissionEvents(events)) return events

	const normalizedEvents: EmissionEvent[] = []
	for (const event of events) normalizedEvents.push(normalizeEmissionEvent(event))
	return normalizedEvents
}

function isNormalizedProtocolEmission(value: RawProtocolEmission): value is ProtocolEmission {
	const events = value.events
	return events == null || areNormalizedEmissionEvents(events)
}

function isNormalizedProtocolEmissionDetail(value: RawProtocolEmissionDetail): value is ProtocolEmissionDetail {
	const events = value.metadata?.events
	return events == null || areNormalizedEmissionEvents(events)
}

/**
 * Fetch emission data for a single protocol
 */
export async function fetchProtocolEmission(protocolName: string): Promise<ProtocolEmissionDetail | null> {
	if (!protocolName) return null
	const encodedProtocolName = encodeURIComponent(protocolName)
	try {
		const response = await fetchJson<RawProtocolEmissionDetail>(`${PROTOCOL_EMISSION_API}/${encodedProtocolName}`)
		if (isNormalizedProtocolEmissionDetail(response)) return response
		const { metadata, ...detail } = response
		const { events, ...metadataFields } = metadata
		return {
			...detail,
			metadata: {
				...metadataFields,
				events: normalizeEmissionEvents(events)
			}
		}
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
		// The endpoint is ascending, but a few legacy rows encode the timestamp as
		// a numeric string. Normalize that known boundary mismatch once so all
		// downstream chart/calendar loops keep a strict numeric contract.
		const protocols: ProtocolEmission[] = []
		for (const protocol of res) {
			if (isNormalizedProtocolEmission(protocol)) {
				protocols.push(protocol)
				continue
			}

			const events = protocol.events
			if (!events) continue
			const normalizedEvents = normalizeEmissionEvents(events)
			protocols.push({ ...protocol, events: normalizedEvents })
		}

		return protocols
	} catch {
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
		return res
	} catch (error) {
		console.error('Failed to fetch emissions protocols list:', error)
		return []
	}
}
