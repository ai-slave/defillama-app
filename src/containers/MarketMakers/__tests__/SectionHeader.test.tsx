import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RfqButton } from '../SectionHeader'

describe('RfqButton', () => {
	it('links directly to the Forgd request-for-quotations tool', () => {
		const html = renderToStaticMarkup(<RfqButton />)

		expect(html).toContain('href="https://www.forgd.com/engage-a-market-maker/request-for-quotations"')
		expect(html).toContain('target="_blank"')
		expect(html).toContain('rel="noreferrer noopener"')
	})
})
