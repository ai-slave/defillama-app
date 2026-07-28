import { describe, expect, it } from 'vitest'
import { placeholderTitleFromMessage } from '../sessionTitle'

describe('placeholderTitleFromMessage', () => {
	it('returns null when there is nothing to show, so callers fall through to a display default', () => {
		expect(placeholderTitleFromMessage(null)).toBeNull()
		expect(placeholderTitleFromMessage(undefined)).toBeNull()
		expect(placeholderTitleFromMessage('   \n  ')).toBeNull()
	})

	it('passes short messages through verbatim', () => {
		expect(placeholderTitleFromMessage('how is aave doing')).toBe('how is aave doing')
	})

	it('collapses whitespace and newlines so a pasted block renders as one sidebar line', () => {
		expect(placeholderTitleFromMessage('how is\n\naave   doing?')).toBe('how is aave doing?')
	})

	it('cuts at a word boundary within budget, matching the server projection', () => {
		const out = placeholderTitleFromMessage('compare the total value locked of aave and compound across every chain')
		expect(out).toBe('compare the total value locked of aave and')
		expect(out!.length).toBeLessThanOrEqual(50)
	})

	it('hard-cuts a single unbroken token rather than returning nothing', () => {
		const url = `https://defillama.com/protocol/${'a'.repeat(80)}`
		expect(placeholderTitleFromMessage(url)).toBe(url.slice(0, 50))
	})
})
