import { describe, expect, it } from 'vitest'
import { getToolLabel } from '~/containers/LlamaAI/toolMetadata'

describe('toolMetadata', () => {
	it('formats unknown tool names into a readable fallback label', () => {
		expect(getToolLabel('new_backend_tool')).toBe('New Backend Tool')
	})
})
