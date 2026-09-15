import { SERVER_URL } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { ProtocolsResponse } from './api.types'

const PROTOCOLS_LITE_API_URL = `${SERVER_URL}/lite/protocols2?zz=19`

/** Fetch all protocols from lite/protocols2. */
export async function fetchProtocols(): Promise<ProtocolsResponse> {
	return fetchJson<ProtocolsResponse>(PROTOCOLS_LITE_API_URL)
}
