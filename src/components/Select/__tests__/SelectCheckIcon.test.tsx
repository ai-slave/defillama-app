import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SelectCheckIcon } from '../SelectCheckIcon'

describe('SelectCheckIcon', () => {
	it('uses a heavier stroke without increasing the select indicator footprint', () => {
		const html = renderToStaticMarkup(<SelectCheckIcon />)

		expect(html).toContain('stroke-width="3"')
		expect(html).toContain('class="size-3"')
	})
})
