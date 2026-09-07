export const AB_EXPERIMENT_ID = 'foundation-aa-v1'
export const AB_VISITOR_COOKIE_NAME = 'defillama-ab-id'
export const AB_GROUP_COOKIE_NAME = 'defillama-ab-group'
export const AB_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export type ABGroup = 'a' | 'b'

export type ABClientAssignment = {
	visitorId: string
	group: ABGroup
	shouldSetVisitorCookie: boolean
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isABVisitorId(value: string | undefined): value is string {
	return Boolean(value && UUID_PATTERN.test(value))
}

export function isABGroup(value: string | undefined): value is ABGroup {
	return value === 'a' || value === 'b'
}

export function getABGroup(visitorId: string): ABGroup {
	const lastHexCharacter = visitorId.at(-1) ?? '0'
	return Number.parseInt(lastHexCharacter, 16) < 8 ? 'a' : 'b'
}

export function getABGroupFromCookie(cookieString: string): ABGroup | null {
	const group = getCookieValue(cookieString, AB_GROUP_COOKIE_NAME)

	return isABGroup(group) ? group : null
}

function getCookieValue(cookieString: string, name: string): string | undefined {
	return cookieString
		.split(';')
		.map((cookie) => cookie.trim())
		.find((cookie) => cookie.startsWith(`${name}=`))
		?.slice(name.length + 1)
}

export function getABClientAssignment(cookieString: string, createVisitorId: () => string): ABClientAssignment | null {
	if (getABGroupFromCookie(cookieString)) return null

	const currentVisitorId = getCookieValue(cookieString, AB_VISITOR_COOKIE_NAME)
	const hasValidVisitorId = isABVisitorId(currentVisitorId)
	const visitorId = hasValidVisitorId ? currentVisitorId : createVisitorId()

	return {
		visitorId,
		group: getABGroup(visitorId),
		shouldSetVisitorCookie: !hasValidVisitorId
	}
}

export function getABTag(group: ABGroup): string {
	return `ab:${AB_EXPERIMENT_ID}:${group}`
}
