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
	if (!response || !response.ok) {
		const errorData = await response?.json().catch(() => null)
		throw new Error(errorData?.error ?? `Download failed (${response?.status})`)
	}
	return response.text()
}
