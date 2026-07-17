import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MetadataFieldValue } from '../MetadataGroups'

describe('MetadataFieldValue', () => {
	it('renders a founding year without numeric grouping', () => {
		const html = renderToStaticMarkup(
			<MetadataFieldValue field={{ key: 'founded', label: 'Founded', type: 'number', value: 2017, comparable: true }} />
		)

		expect(html).toBe('2017')
	})

	it('renders canonical link fields as active external links', () => {
		const html = renderToStaticMarkup(
			<MetadataFieldValue
				field={{
					key: 'proof',
					label: 'Proof',
					type: 'link',
					value: { label: 'Proof page', url: 'https://example.com/proof' },
					comparable: false
				}}
			/>
		)

		expect(html).toContain('href="https://example.com/proof"')
		expect(html).toContain('Proof page')
	})
})
