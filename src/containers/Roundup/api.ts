import { fetchWithPoolingOnServer } from '~/utils/http-client'

export type RoundupProps = { messages: Array<string | Array<string>>; date: string }

/** Returns null when the bot token is not configured so the page can 404 instead of failing the build. */
export async function fetchRoundup(token: string | undefined): Promise<RoundupProps | null> {
	if (!token?.trim()) {
		console.warn('[build] ROUND_UP_BOT_TOKEN is not set, /roundup will return 404')
		return null
	}

	const headers = new Headers()
	headers.append('Authorization', `Bot ${token}`)

	let data = []

	const response = await fetchWithPoolingOnServer('https://discordapp.com/api/channels/965023197365960734/messages', {
		method: 'GET',
		headers,
		redirect: 'follow'
	})

	if (response.ok) {
		data = await response.json()
	} else {
		throw new Error(`Couldn't load roundup messages: ${response.status} ${response.statusText}`)
	}

	const index = data.findIndex((d) => d.content.startsWith('🦙 Llama News Round-Up')) ?? null

	const raw = Number.isNaN(index) ? [] : data.slice(0, index + 1)

	// Combine all messages into one string
	const fullContent = raw
		.reverse()
		.map((m) => m.content)
		.join('\n')

	// Find the main roundup content - look for the start and end
	const startIndex = fullContent.indexOf('🦙 Llama News Round-Up')
	const roundupContent = startIndex !== -1 ? fullContent.substring(startIndex) : fullContent

	// Extract the date from the title
	const dateMatch = roundupContent.match(/🦙 Llama News Round-Up \| (.+?)\n/)
	const date = dateMatch ? dateMatch[1] : ''

	// Extract all numbered references first
	const numberedRefs = {}
	const refMatches = roundupContent.matchAll(/\[(\d+)\]:\s*(.+)/g)
	for (const match of refMatches) {
		numberedRefs[match[1]] = match[2]
	}

	// Split content into lines and process
	const lines = roundupContent.split('\n')
	const formattedMessages = []

	for (const line of lines) {
		const trimmedLine = line.trim()
		if (!trimmedLine) continue

		// Skip the title line
		if (trimmedLine.includes('🦙 Llama News Round-Up')) continue

		// Check if this line contains a numbered reference like [1], [2], etc.
		const numberedRefMatch = trimmedLine.match(/\[(\d+)\]:\s*(.+)/)
		if (numberedRefMatch) {
			// This is a reference line, skip it
			continue
		}

		// Check if this line contains a numbered reference in content like [1], [2], etc.
		const contentRefMatch = trimmedLine.match(/\[(\d+)\]/)
		if (contentRefMatch) {
			const number = contentRefMatch[1]
			const url = numberedRefs[number]
			if (url) {
				// Extract the title by removing the [number] reference and right arrow
				const title = trimmedLine
					.replace(`[${number}]`, '')
					.replace(/^→\s*/, '')
					.trim()
				if (title) {
					formattedMessages.push([title, url])
				}
			}
		} else if (
			trimmedLine &&
			!trimmedLine.startsWith('[') &&
			!trimmedLine.match(/^\d+\/\d+/) &&
			!trimmedLine.match(/^\[(\d+)\]:/) &&
			// A section header carries an emoji or one of the known category names.
			(trimmedLine.match(/\p{Emoji}/u) ||
				trimmedLine.match(/^(News|Layer 1|DeFi|Reads|Raises|Security|AI|Llama Update)/))
		) {
			formattedMessages.push(trimmedLine)
		}
	}

	return { messages: formattedMessages, date }
}
