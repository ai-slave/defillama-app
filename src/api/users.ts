import { FEATURES_SERVER } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { UserInterestsResponse } from './users.types'

/** Fetch interests through features-server with the user's PocketBase token; analytics credentials stay server-side. */
export function fetchUserInterests(token: string): Promise<UserInterestsResponse> {
	return fetchJson<UserInterestsResponse>(`${FEATURES_SERVER}/profile/interests`, {
		headers: { Authorization: `Bearer ${token}` }
	})
}
