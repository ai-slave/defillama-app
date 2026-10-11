// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { tabTo } from '~/utils/testing/keyboard'
import { waitForUi } from '~/utils/testing/waitForUi'
import { IrHeaderLinks } from '../IrHeaderLinks'

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

test('each partner link opens its page in a new tab, and a link whose URL has not loaded is left out', async () => {
	await act(async () =>
		root.render(
			<IrHeaderLinks
				links={[
					{ label: 'Website', href: 'https://example.org', icon: 'globe' },
					{ label: 'Docs', href: undefined, icon: 'file-text' },
					{ label: 'Partner', href: 'https://partner.example', logo: '/assets/placeholder.png' }
				]}
				launch={{ label: 'Launch App', href: 'https://app.example.org', background: '#000' }}
			/>
		)
	)
	const links = [...container.querySelectorAll('a')]
	expect(links.map((link) => [accessibleName(link), link.getAttribute('href'), link.target])).toEqual([
		['Website', 'https://example.org', '_blank'],
		['Partner', 'https://partner.example', '_blank'],
		['Launch App', 'https://app.example.org', '_blank']
	])
})

test('a link shown as an icon alone names itself when a keyboard reader reaches it', async () => {
	await act(async () =>
		root.render(<IrHeaderLinks links={[{ label: 'Explorer', href: 'https://scan.example', icon: 'search' }]} />)
	)
	await tabTo(container.querySelector('a')!)
	await waitForUi(() => expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Explorer'))
})
