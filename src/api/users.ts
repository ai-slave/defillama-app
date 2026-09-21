import { fetchJson } from '~/utils/async'
import type { UserInterestsResponse } from './users.types'

const USERS_API_URL = 'https://users-api.llama.team'

/** Fetch the authenticated user's interests using their PocketBase token. Request failures propagate to the caller. */
export function fetchUserInterests(token: string): Promise<UserInterestsResponse> {
	return fetchJson<UserInterestsResponse>(`${USERS_API_URL}/api/profile/interests`, {
		headers: { Authorization: `Bearer ${token}` }
	})
}
