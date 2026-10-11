export const getAuthErrorMessageFromResponse = async (response: Response, fallbackMessage: string): Promise<string> => {
	// The auth server writes its 4xx refusals for readers; a 5xx or proxy body is not reader copy.
	if (response.status >= 500) return fallbackMessage
	let parsed: unknown = null
	try {
		parsed = await response.json()
	} catch {
		return fallbackMessage
	}

	if (parsed == null || typeof parsed !== 'object') {
		return fallbackMessage
	}

	const messageValue = (parsed as { message?: unknown }).message
	if (typeof messageValue === 'string' && messageValue.length > 0) {
		return messageValue
	}

	const errorValue = (parsed as { error?: unknown }).error
	if (typeof errorValue === 'string' && errorValue.length > 0) {
		return errorValue
	}

	return fallbackMessage
}
