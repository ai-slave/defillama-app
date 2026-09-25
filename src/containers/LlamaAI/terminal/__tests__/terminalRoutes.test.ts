import { describe, expect, test } from 'vitest'
import {
	chatSessionUrl,
	isTerminalPath,
	legacyTerminalRedirect,
	terminalAccessRedirect,
	terminalEntryFromUrl,
	terminalEntryUrl
} from '../terminalRoutes'

/**
 * A chat is either a terminal chat or a plain chat, and its path says which. `?symbol=` is only a
 * way in: it is read once and dropped, so a copied session URL never drags a stale coin along.
 */

const redirect = (href: string) => {
	const url = new URL(href, 'https://defillama.com')
	return legacyTerminalRedirect(url.pathname, url.searchParams)
}

describe('which path a chat opens on', () => {
	test('a chart chat opens under the terminal, a plain chat under chat, and neither carries a query', () => {
		expect(chatSessionUrl('abc', 'SOL')).toBe('/ai/terminal/abc')
		expect(chatSessionUrl('abc', 'SOL', '#msg-1')).toBe('/ai/terminal/abc#msg-1')
		expect(chatSessionUrl('abc', null)).toBe('/ai/chat/abc')
		expect(chatSessionUrl('abc', undefined, '#msg-1')).toBe('/ai/chat/abc#msg-1')
	})

	test('only the terminal paths count as the terminal', () => {
		expect(isTerminalPath('/ai/terminal')).toBe(true)
		expect(isTerminalPath('/ai/terminal/[sessionId]')).toBe(true)
		expect(isTerminalPath('/ai/terminals')).toBe(false)
		expect(isTerminalPath('/ai/chat')).toBe(false)
	})
})

describe('the ?symbol entry link', () => {
	test('opens the terminal on that coin once, then leaves a clean address', () => {
		expect(terminalEntryFromUrl('/ai/terminal?symbol=ETH')).toEqual({ symbol: 'ETH', cleanUrl: '/ai/terminal' })
		expect(terminalEntryFromUrl('/ai/terminal')).toEqual({})
	})

	test('a HIP-3 coin id survives the round trip exactly', () => {
		const href = terminalEntryUrl('xyz:TSLA')
		expect(href).toBe('/ai/terminal?symbol=xyz%3ATSLA')
		expect(terminalEntryFromUrl(href).symbol).toBe('xyz:TSLA')
	})

	test('a session URL keeps its own coin: any query is dropped, the anchor kept', () => {
		expect(terminalEntryFromUrl('/ai/terminal/abc?symbol=ETH#msg-1')).toEqual({
			symbol: undefined,
			cleanUrl: '/ai/terminal/abc#msg-1'
		})
	})

	test('a deep-link prompt and campaign tags ride along; only symbol and view are consumed', () => {
		expect(terminalEntryFromUrl('/ai/terminal?symbol=ETH&prompt=hello&utm_source=x')).toEqual({
			symbol: 'ETH',
			cleanUrl: '/ai/terminal?prompt=hello&utm_source=x'
		})
		expect(terminalEntryFromUrl('/ai/terminal?prompt=hello&utm_source=x')).toEqual({})
		expect(terminalEntryFromUrl('/ai/terminal/abc?view=terminal&prompt=hi#m')).toEqual({
			symbol: undefined,
			cleanUrl: '/ai/terminal/abc?prompt=hi#m'
		})
	})

	test('the chat page ignores ?symbol', () => {
		expect(terminalEntryFromUrl('/ai/chat?symbol=ETH')).toEqual({})
	})
})

describe('old ?view=terminal links', () => {
	test('a new-chat link lands on the terminal with its coin, encoded', () => {
		expect(redirect('/ai/chat?view=terminal')).toBe('/ai/terminal')
		expect(redirect('/ai/chat?view=terminal&symbol=ARB')).toBe('/ai/terminal?symbol=ARB')
		expect(redirect('/ai/chat?view=terminal&symbol=xyz:TSLA')).toBe('/ai/terminal?symbol=xyz%3ATSLA')
	})

	test('a session link lands on that terminal chat without a query', () => {
		expect(redirect('/ai/chat/abc?view=terminal')).toBe('/ai/terminal/abc')
		expect(redirect('/ai/chat/abc?view=terminal&symbol=ETH')).toBe('/ai/terminal/abc')
	})

	test('every other param survives the redirect', () => {
		expect(redirect('/ai/chat?view=terminal&symbol=ARB&prompt=hi&utm_source=x')).toBe(
			'/ai/terminal?symbol=ARB&prompt=hi&utm_source=x'
		)
		expect(redirect('/ai/chat?view=terminal&prompt=hi')).toBe('/ai/terminal?prompt=hi')
		expect(redirect('/ai/chat/abc?view=terminal&symbol=ETH&shareToken=t')).toBe('/ai/terminal/abc?shareToken=t')
	})

	test('shared links and plain chat links are left alone', () => {
		expect(redirect('/ai/chat/shared/tok?view=terminal')).toBeNull()
		expect(redirect('/ai/chat/shared?view=terminal')).toBeNull()
		expect(redirect('/ai/chat/abc')).toBeNull()
		expect(redirect('/ai/chat?symbol=ARB')).toBeNull()
		expect(redirect('/ai/projects/p?view=terminal')).toBeNull()
	})
})

// The terminal is an is_llama feature. Anyone else reaching a terminal path lands on the same chat
// under /ai/chat. Google sign-in stores an identity-only record (no collectionId, no flags) until the
// profile refresh lands, so only the full server record can say "not llama"; a trimmed one never
// bounces, or a llama user signing in with Google is thrown out of the terminal.
const fullRecord = (isLlama: boolean) => ({ id: 'u', collectionId: '_pb_users_auth_', flags: { is_llama: isLlama } })

describe('who may stay on a terminal path', () => {
	test('a non-llama user is sent to the same chat under /ai/chat, keeping the rest of the link', () => {
		const user = fullRecord(false)
		expect(terminalAccessRedirect('/ai/terminal', user)).toBe('/ai/chat')
		expect(terminalAccessRedirect('/ai/terminal/abc?symbol=ETH#msg-1', user)).toBe('/ai/chat/abc#msg-1')
		expect(terminalAccessRedirect('/ai/terminal?symbol=ETH&prompt=hi&utm_source=x', user)).toBe(
			'/ai/chat?prompt=hi&utm_source=x'
		)
		expect(terminalAccessRedirect('/ai/chat/abc', user)).toBeNull()
	})

	test('a llama user stays', () => {
		expect(terminalAccessRedirect('/ai/terminal/abc', fullRecord(true))).toBeNull()
	})

	test('an identity-only record never redirects, whatever its flags say', () => {
		const googleRecord = { id: 'u', email: 'a@b.c', verified: true } as Parameters<typeof terminalAccessRedirect>[1]
		expect(terminalAccessRedirect('/ai/terminal/abc', googleRecord)).toBeNull()
		expect(terminalAccessRedirect('/ai/terminal/abc', { flags: {} })).toBeNull()
		expect(terminalAccessRedirect('/ai/terminal/abc', null)).toBeNull()
	})
})
