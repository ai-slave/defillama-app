// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { MetadataFieldValue } from '../MetadataGroups'

describe('MetadataFieldValue', () => {
	test('renders a founding year without numeric grouping', () => {
		const html = renderToStaticMarkup(
			<MetadataFieldValue field={{ key: 'founded', label: 'Founded', type: 'number', value: 2017, comparable: true }} />
		)

		expect(new DOMParser().parseFromString(html, 'text/html').body.textContent).toBe('2017')
	})

	test('renders canonical link fields as active external links', () => {
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
