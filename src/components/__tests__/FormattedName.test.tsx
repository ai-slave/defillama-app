import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FormattedName } from '../FormattedName'

describe('FormattedName', () => {
	it('renders the bare ellipsized span on the server with no tooltip markup', () => {
		const html = renderToStaticMarkup(<FormattedName text="Uniswap" />)

		expect(html).toContain('Uniswap')
		expect(html).toContain('text-ellipsis')
		expect(html).toContain('data-link="false"')
		expect(html).not.toContain('cursor-pointer')
	})

	it('ignores the deprecated maxCharacters prop for server rendering', () => {
		// Tooltip eligibility is measured from real DOM overflow after mount;
		// exceeding maxCharacters must not change the server output.
		const withLimit = renderToStaticMarkup(<FormattedName text="A very long protocol name" maxCharacters={5} />)
		const withoutLimit = renderToStaticMarkup(<FormattedName text="A very long protocol name" />)

		expect(withLimit).toBe(withoutLimit)
		expect(withLimit).not.toContain('cursor-pointer')
	})

	it('marks link text via data-link', () => {
		const html = renderToStaticMarkup(<FormattedName text="Uniswap" link />)

		expect(html).toContain('data-link="true"')
	})

	it('renders nothing for empty text', () => {
		expect(renderToStaticMarkup(<FormattedName text="" />)).toBe('')
	})
})
