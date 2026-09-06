import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { IHackApiItem } from './api.types'
import { normalizeHack, type Hack } from './model'

/**
 * Fetch the list of recorded hacks.
 */
export async function fetchHacks(): Promise<Array<Hack>> {
	const hacks = await fetchJson<Array<IHackApiItem>>(`${SERVER_URL}/hacks`)
	return hacks.map(normalizeHack)
}
