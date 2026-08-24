import { DATASETS_SERVER_URL, SERVER_URL } from '~/constants'
import { fetchJson, getSlowJsonTimeoutMs, handleFetchResponse } from '~/utils/async'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import type {
	EmissionEvent,
	KnownEmissionEvent,
	ProtocolEmission,
	ProtocolEmissionDetail,
	RawEmissionEvent,
	RawProtocolEmission,
	RawProtocolEmissionDetail,
	RawStructuredEmissionEvent,
	StructuredEmissionEvent
} from './api.types'

const PROTOCOL_EMISSIONS_API = `${SERVER_URL}/emissions`
const PROTOCOL_EMISSIONS_LIST_API = `${DATASETS_SERVER_URL}/emissionsProtocolsList`
const PROTOCOL_EMISSION_API = `${DATASETS_SERVER_URL}/emissions`

function isNormalizedEmissionEvent(event: RawEmissionEvent): event is KnownEmissionEvent {
	if (typeof event.timestamp !== 'number') return false
	if (event.unlockType === 'cliff') return event.noOfTokens[0] !== null
	return event.noOfTokens[1] !== null
}

function areNormalizedEmissionEvents(events: RawEmissionEvent[]): events is KnownEmissionEvent[] {
	for (const event of events) {
		if (!isNormalizedEmissionEvent(event)) return false
	}
	return true
}

function normalizeEmissionEvent(event: RawEmissionEvent): EmissionEvent {
	if (isNormalizedEmissionEvent(event)) return event

	const timestamp = typeof event.timestamp === 'string' ? Number(event.timestamp) : event.timestamp
	if (event.unlockType === 'cliff') {
		const amount = event.noOfTokens[0]
		if (amount === null) {
			return {
				description: event.description,
				category: event.category,
				unlockType: 'cliff',
				timestamp,
				noOfTokens: [],
				hasUnknownTokenAmount: true
			}
		}
		return {
			description: event.description,
			category: event.category,
			unlockType: 'cliff',
			timestamp,
			noOfTokens: [amount]
		}
	}

	const previousRatePerWeek = event.noOfTokens[0]
	const newRatePerWeek = event.noOfTokens[1]
	if (newRatePerWeek === null) {
		return {
			description: event.description,
			category: event.category,
			unlockType: 'linear',
			timestamp,
			noOfTokens: [],
			rateDurationDays: event.rateDurationDays,
			hasUnknownTokenAmount: true
		}
	}
	return {
		description: event.description,
		category: event.category,
		unlockType: 'linear',
		timestamp,
		noOfTokens: [previousRatePerWeek, newRatePerWeek],
		rateDurationDays: event.rateDurationDays
	}
}

export function normalizeEmissionEvents(events: RawEmissionEvent[]): EmissionEvent[] {
	if (areNormalizedEmissionEvents(events)) return events

	const normalizedEvents: EmissionEvent[] = []
	for (const event of events) normalizedEvents.push(normalizeEmissionEvent(event))
	return normalizedEvents
}

function isNormalizedStructuredEmissionEvent(event: RawStructuredEmissionEvent): event is StructuredEmissionEvent {
	for (const allocation of event.linearAllocations) {
		if (typeof allocation.endTimestamp !== 'number') return false
	}
	return true
}

function areNormalizedStructuredEmissionEvents(
	events: RawStructuredEmissionEvent[]
): events is StructuredEmissionEvent[] {
	for (const event of events) {
		if (!isNormalizedStructuredEmissionEvent(event)) return false
	}
	return true
}

function normalizeStructuredEmissionEvents(events: RawStructuredEmissionEvent[]): StructuredEmissionEvent[] {
	if (areNormalizedStructuredEmissionEvents(events)) return events
	const normalized = new Array<StructuredEmissionEvent>(events.length)
	for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
		const event = events[eventIndex]!
		if (isNormalizedStructuredEmissionEvent(event)) {
			normalized[eventIndex] = event
			continue
		}
		const linearAllocations = new Array(event.linearAllocations.length)
		for (let allocationIndex = 0; allocationIndex < event.linearAllocations.length; allocationIndex++) {
			const allocation = event.linearAllocations[allocationIndex]!
			linearAllocations[allocationIndex] = {
				...allocation,
				endTimestamp:
					typeof allocation.endTimestamp === 'string' ? Number(allocation.endTimestamp) : allocation.endTimestamp
			}
		}
		normalized[eventIndex] = { ...event, linearAllocations }
	}
	return normalized
}

function isNormalizedProtocolEmission(
	value: RawProtocolEmission
): value is RawProtocolEmission & { events: KnownEmissionEvent[]; unlockEvents: StructuredEmissionEvent[] } {
	return areNormalizedEmissionEvents(value.events) && areNormalizedStructuredEmissionEvents(value.unlockEvents)
}

export function normalizeProtocolEmission(value: RawProtocolEmission): ProtocolEmission {
	if (isNormalizedProtocolEmission(value)) return value
	return {
		...value,
		events: normalizeEmissionEvents(value.events),
		unlockEvents: normalizeStructuredEmissionEvents(value.unlockEvents)
	}
}

export function normalizeProtocolEmissions(values: RawProtocolEmission[]): ProtocolEmission[] {
	const normalized = new Array<ProtocolEmission>(values.length)
	for (let index = 0; index < values.length; index++) normalized[index] = normalizeProtocolEmission(values[index]!)
	return normalized
}

function isNormalizedProtocolEmissionDetail(value: RawProtocolEmissionDetail): value is RawProtocolEmissionDetail & {
	metadata: { events: KnownEmissionEvent[]; unlockEvents: StructuredEmissionEvent[] }
} {
	return (
		areNormalizedEmissionEvents(value.metadata.events) &&
		areNormalizedStructuredEmissionEvents(value.metadata.unlockEvents)
	)
}

function normalizeProtocolEmissionDetail(value: RawProtocolEmissionDetail): ProtocolEmissionDetail {
	if (isNormalizedProtocolEmissionDetail(value)) return value
	return {
		...value,
		metadata: {
			...value.metadata,
			events: normalizeEmissionEvents(value.metadata.events),
			unlockEvents: normalizeStructuredEmissionEvents(value.metadata.unlockEvents)
		}
	}
}

/** Fetch the canonical schedule for one emissions slug. A missing R2 object is the only null outcome. */
export async function fetchProtocolEmission(protocolName: string): Promise<ProtocolEmissionDetail | null> {
	if (!protocolName) throw new Error('Protocol emission slug is required')
	const encodedProtocolName = encodeURIComponent(protocolName)
	const response = await fetchWithPoolingOnServer(`${PROTOCOL_EMISSION_API}/${encodedProtocolName}`, {
		timeout: getSlowJsonTimeoutMs()
	})
	if (response.status === 404) return null
	if (!response.ok) {
		await handleFetchResponse(response)
		throw new Error('Unreachable protocol emissions response state')
	}
	const body: RawProtocolEmissionDetail = await response.json()
	return normalizeProtocolEmissionDetail(body)
}

/** Fetch and normalize the aggregate emissions index. */
export async function fetchAllProtocolEmissions(): Promise<ProtocolEmission[]> {
	const response = await fetchJson<RawProtocolEmission[]>(PROTOCOL_EMISSIONS_API)
	return normalizeProtocolEmissions(response)
}

/** Fetch the authoritative set of protocol slugs with emissions data. */
export async function fetchEmissionsProtocolsList(options: { timeout?: number } = {}): Promise<string[]> {
	return fetchJson<string[]>(PROTOCOL_EMISSIONS_LIST_API, {
		timeout: options.timeout ?? getSlowJsonTimeoutMs()
	})
}
