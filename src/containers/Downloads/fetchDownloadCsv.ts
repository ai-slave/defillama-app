import { HttpError, ReaderError } from '~/utils/async'

type AuthorizedFetch = (url: string) => Promise<Response | null>

/** One downloads API read. A preview goes out unauthenticated with a cache-busting nonce, so each preview is a fresh
    request; a full read goes through the account's authorized fetch. */
export async function fetchDownloadCsv(
	path: string,
	{ isPreview, authorizedFetch }: { isPreview: boolean; authorizedFetch: AuthorizedFetch }
): Promise<string> {
	const response = isPreview
		? await fetch(`${path}${path.includes('?') ? '&' : '?'}_n=${Math.random().toString(36).slice(2)}`)
		: await authorizedFetch(path)
	if (!response) throw new ReaderError('Sign in to download this data.')
	if (!response.ok) {
		// The route's 4xx `error` names the fix ("No data returned for the specified parameter", a paid-plan gate).
		const errorData = await response.json().catch(() => null)
		throw new HttpError(`Download returned ${response.status}`, response.status, errorData?.error ?? null)
	}
	return response.text()
}
