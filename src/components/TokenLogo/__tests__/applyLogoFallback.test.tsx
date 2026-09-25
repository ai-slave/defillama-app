// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test } from 'vitest'
import { applyLogoFallback } from '../applyLogoFallback'

const PLACEHOLDER = '/assets/placeholder.png'
const roots: Array<Root> = []

afterEach(async () => {
	await act(async () => {
		for (const root of roots) root.unmount()
	})
	roots.length = 0
	document.body.replaceChildren()
})

/** One image whose source changes, the way Compare Tokens reuses it as the selection changes. */
function Logo({ src }: { src: string }) {
	return <img alt="" src={src} onError={(event) => applyLogoFallback(event.currentTarget)} />
}

async function render(src: string): Promise<(next: string) => Promise<HTMLImageElement>> {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	roots.push(root)
	await act(async () => root.render(<Logo src={src} />))
	return async (next: string) => {
		await act(async () => root.render(<Logo src={next} />))
		return container.querySelector('img')!
	}
}

function fail(image: HTMLImageElement): void {
	image.dispatchEvent(new Event('error'))
}

test('a broken logo falls back to the placeholder', async () => {
	const select = await render('https://icons.llama.fi/a.png')
	const image = await select('https://icons.llama.fi/a.png')

	fail(image)

	expect(image.getAttribute('src')).toBe(PLACEHOLDER)
})

test('a broken placeholder is assigned once, not on every error', async () => {
	const select = await render('https://icons.llama.fi/a.png')
	const image = await select('https://icons.llama.fi/a.png')
	const assigned: Array<string> = []
	const setAttribute = image.setAttribute.bind(image)
	image.setAttribute = (name: string, value: string) => {
		if (name === 'src') assigned.push(value)
		setAttribute(name, value)
	}

	for (let attempt = 0; attempt < 5; attempt++) fail(image)

	expect(assigned).toEqual([PLACEHOLDER])
	expect(image.getAttribute('src')).toBe(PLACEHOLDER)
})

test('a token selected after a failed one still gets its own placeholder', async () => {
	const select = await render('https://icons.llama.fi/a.png')
	fail(await select('https://icons.llama.fi/a.png'))

	const second = await select('https://icons.llama.fi/b.png')
	fail(second)

	expect(second.getAttribute('src')).toBe(PLACEHOLDER)
})
