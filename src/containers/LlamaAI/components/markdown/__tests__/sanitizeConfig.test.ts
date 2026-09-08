import type { Root } from 'hast'
import rehypeSanitize, { type Options as SanitizeSchema } from 'rehype-sanitize'
import { describe, expect, test } from 'vitest'
import { SANITIZE_SCHEMA } from '../sanitizeConfig'

describe('SANITIZE_SCHEMA', () => {
	test('preserves the fact-check pill dataRef property used by rehype', () => {
		const tree: Root = {
			type: 'root',
			children: [
				{
					type: 'element',
					tagName: 'fact-check-pill',
					properties: { dataRef: '3' },
					children: []
				}
			]
		}
		const schema: SanitizeSchema = SANITIZE_SCHEMA

		// Through the plugin the renderer uses, which wraps hast-util-sanitize itself.
		const sanitized = rehypeSanitize(schema)(tree)
		if (sanitized.type !== 'root') throw new Error('Expected a sanitized root')
		const pill = sanitized.children[0]
		if (pill.type !== 'element') throw new Error('Expected a sanitized element')

		expect(pill.properties).toEqual({ dataRef: '3' })
	})
})
