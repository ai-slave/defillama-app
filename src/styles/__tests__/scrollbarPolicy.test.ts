import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(new URL('../../tailwind.css', import.meta.url), 'utf8')

describe('nested scrollbar policy', () => {
	it('makes descendant scrollbars thin without styling the document scrollbar', () => {
		const nestedRule = stylesheet.match(/:where\(body \*\)\s*\{([^}]*)\}/)?.[1] ?? ''

		expect(nestedRule).toContain('scrollbar-width: thin')
		expect(stylesheet).not.toMatch(/(?:^|\n)\s*(?:html|body)\s*\{[^}]*scrollbar-width:\s*thin/s)
	})

	it('keeps the explicit hidden-scrollbar override', () => {
		const hiddenRule = stylesheet.match(/@utility no-scrollbar\s*\{([^}]*)\}/)?.[1] ?? ''
		const removedUtilityName = ['@utility thin', 'scrollbar'].join('-')

		expect(hiddenRule).toContain('scrollbar-width: none')
		expect(stylesheet).not.toContain(removedUtilityName)
	})
})
