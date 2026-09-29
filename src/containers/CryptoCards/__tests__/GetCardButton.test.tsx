// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { GetCardButton } from '../GetCardButton'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('a card with a link opens it, which is its partner link, in a new tab; a card without one offers nothing', async () => {
	await act(async () =>
		root.render(
			<>
				<GetCardButton cardId="etherfi" cardName="EtherFi" url="https://www.ether.fi/@defillama" placement="table" />
				<GetCardButton cardId="coinbase-one" cardName="Coinbase One Card" url={null} placement="table" />
			</>
		)
	)

	expect(
		Array.from(container.querySelectorAll('a'), (link) => [link.getAttribute('aria-label'), link.href, link.target])
	).toEqual([['Get EtherFi', 'https://www.ether.fi/@defillama', '_blank']])
})

test('Ethena Pay shows its invite code instead of leaving the page', async () => {
	await act(async () =>
		root.render(
			<GetCardButton cardId="ethena-pay" cardName="Ethena Pay" url="https://pay.ethena.fi/" placement="details" />
		)
	)
	expect(container.querySelector('a')).toBeNull()

	await act(async () =>
		container.querySelector<HTMLButtonElement>('[aria-label="Get Ethena Pay invite code"]')!.click()
	)
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())

	expect(document.querySelector('[role="dialog"] output')?.textContent).toBe('TDQTXQ')
})
