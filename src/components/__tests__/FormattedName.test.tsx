import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FormattedName } from '../FormattedName'

describe('FormattedName', () => {
	it('renders a bare ellipsized span without a character limit', () => {
		const html = renderToStaticMarkup(<FormattedName text="Uniswap" />)

		expect(html).toContain('Uniswap')
		expect(html).toContain('text-ellipsis')
		expect(html).toContain('data-link="false"')
		expect(html).not.toContain('cursor-pointer')
	})

	it('renders a tooltip only when text exceeds maxCharacters', () => {
		const withLimit = renderToStaticMarkup(<FormattedName text="A very long protocol name" maxCharacters={5} />)
		const withoutLimit = renderToStaticMarkup(<FormattedName text="A very long protocol name" />)

		expect(withLimit).toContain('cursor-pointer')
		expect(withLimit).not.toBe(withoutLimit)
		expect(withoutLimit).not.toContain('cursor-pointer')
	})

	it('marks link text via data-link', () => {
		const html = renderToStaticMarkup(<FormattedName text="Uniswap" link />)

		expect(html).toContain('data-link="true"')
	})

	it('renders nothing for empty text', () => {
		expect(renderToStaticMarkup(<FormattedName text="" />)).toBe('')
	})
})
