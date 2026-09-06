export function canonicalRouteRedirect(destination: string, permanent = false) {
	return {
		redirect: {
			destination,
			permanent
		}
	} as const
}

export function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

export function getSingleRouteParam(value: string | Array<string> | null | undefined): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null
}

export function encodeRouteSegment(value: string): string {
	return encodeURIComponent(safeDecodeURIComponent(value))
}
