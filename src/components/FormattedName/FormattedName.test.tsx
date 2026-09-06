import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { FormattedName } from '.'

describe('FormattedName', () => {
	test('renders a bare ellipsized span without a character limit', () => {
		const html = renderToStaticMarkup(<FormattedName text="Uniswap" />)

		expect(html).toContain('Uniswap')
		expect(html).toContain('truncate')
		expect(html).toContain('data-link="false"')
		expect(html).not.toContain('cursor-pointer')
	})

	test('renders a tooltip only when text exceeds maxCharacters', () => {
		const withLimit = renderToStaticMarkup(<FormattedName text="A very long protocol name" maxCharacters={5} />)
		const withoutLimit = renderToStaticMarkup(<FormattedName text="A very long protocol name" />)

		expect(withLimit).toContain('cursor-pointer')
		expect(withLimit).not.toBe(withoutLimit)
		expect(withoutLimit).not.toContain('cursor-pointer')
	})

	test('marks link text via data-link', () => {
		const html = renderToStaticMarkup(<FormattedName text="Uniswap" link />)

		expect(html).toContain('data-link="true"')
	})

	test('renders nothing for empty text', () => {
		expect(renderToStaticMarkup(<FormattedName text="" />)).toBe('')
	})
})
