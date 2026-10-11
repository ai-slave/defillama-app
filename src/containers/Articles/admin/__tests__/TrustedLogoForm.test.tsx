// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TrustedLogoForm } from '../TrustedLogoForm'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const session = installSubscriberSession('editor-1')

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	session.client.setDefaultOptions({ queries: { retry: false } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('a logo list that fails to load says so with a Try again, not that the logo is missing', async () => {
	session.serve({ [`${FEATURES_SERVER}/research/trusted-by/logos`]: fixtureStatus(500, { error: 'down' }) })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<TrustedLogoForm logoId="logo-1" />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
	expect(container.textContent).not.toContain('Logo not found')

	session.serve({
		[`${FEATURES_SERVER}/research/trusted-by/logos`]: {
			logos: [
				{
					id: 'logo-1',
					name: 'Acme',
					linkUrl: 'https://acme.example',
					imageUrl: '/acme.png',
					sortOrder: 0,
					enabled: true,
					createdAt: '',
					updatedAt: ''
				}
			]
		}
	})
	await act(async () =>
		[...container.querySelectorAll('button')].find((b) => accessibleName(b) === 'Try again')!.click()
	)
	await waitForUi(() => expect(alertTexts(container)).toEqual([]))
	expect(container.textContent).not.toContain('Logo not found')
})
