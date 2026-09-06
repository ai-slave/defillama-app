import { describe, expect, test } from 'vitest'
import { placeholderTitleFromMessage } from '../sessionTitle'

describe('placeholderTitleFromMessage', () => {
	test('returns null when there is nothing to show, so callers fall through to a display default', () => {
		expect(placeholderTitleFromMessage(null)).toBeNull()
		expect(placeholderTitleFromMessage(undefined)).toBeNull()
		expect(placeholderTitleFromMessage('   \n  ')).toBeNull()
	})

	test('passes short messages through verbatim', () => {
		expect(placeholderTitleFromMessage('how is aave doing')).toBe('how is aave doing')
	})

	test('collapses whitespace and newlines so a pasted block renders as one sidebar line', () => {
		expect(placeholderTitleFromMessage('how is\n\naave   doing?')).toBe('how is aave doing?')
	})

	test('cuts at a word boundary within budget, matching the server projection', () => {
		const out = placeholderTitleFromMessage('compare the total value locked of aave and compound across every chain')
		expect(out).toBe('compare the total value locked of aave and')
		expect(out!.length).toBeLessThanOrEqual(50)
	})

	test('hard-cuts a single unbroken token rather than returning nothing', () => {
		const url = `https://defillama.com/protocol/${'a'.repeat(80)}`
		expect(placeholderTitleFromMessage(url)).toBe(url.slice(0, 50))
	})
})
