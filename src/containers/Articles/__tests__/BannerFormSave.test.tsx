// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { BannerForm } from '../admin/BannerForm'
import type { Banner } from '../types'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {} }) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
// Heavy children the assertions never look at.
vi.mock('~/containers/Articles/admin/ArticlePicker', () => ({ ArticlePicker: () => null }))
vi.mock('~/containers/Articles/admin/ArticleMultiPicker', () => ({ ArticleMultiPicker: () => null }))

const session = installSubscriberSession('editor-1')

const banner: Banner = {
	id: 'banner-1',
	type: 'text',
	scope: 'landing',
	section: null,
	articleId: null,
	text: 'Saved banner',
	linkUrl: null,
	linkLabel: null,
	imageUrl: null,
	imageAlt: null,
	imageWideUrl: null,
	imageCardUrl: null,
	imageMobileUrl: null,
	imageLandingMobileUrl: null,
	disclosureText: null,
	disclosureUrl: null,
	landingLinkUrl: null,
	articleLinkUrl: null,
	showOnLanding: true,
	excludedArticleIds: [],
	targetCountries: [],
	enabled: true,
	createdAt: '',
	updatedAt: ''
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('Save changes keeps focus through the save and once nothing is left to save', async () => {
	const saved = Promise.withResolvers<{ banner: Banner }>()
	session.serve({ '/banners/banner-1': () => saved.promise, '/api/private/research/revalidate-landing': {} })
	await act(async () =>
		root.render(
			<session.Wrapper>
				<BannerForm banner={banner} />
			</session.Wrapper>
		)
	)
	const text = container.querySelector('textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(text, 'Edited banner')
		text.dispatchEvent(new Event('input', { bubbles: true }))
	})
	const save = [...container.querySelectorAll('button')].find((el) => el.textContent === 'Save changes')!
	await act(async () => {
		save.focus()
		save.click()
	})
	await waitForUi(() => expect(save.getAttribute('aria-busy')).toBe('true'))
	expect(save.disabled).toBe(false)
	await act(async () => saved.resolve({ banner: { ...banner, text: 'Edited banner' } }))
	await waitForUi(() => expect(save.getAttribute('aria-disabled')).toBe('true'))
	expect(save.textContent).toBe('Save changes')
	expect(save.disabled).toBe(false)
	expect(document.activeElement).toBe(save)
})

test('the audience radios pick on arrow keys and a region tile toggles on each press', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<BannerForm banner={banner} />
			</session.Wrapper>
		)
	)
	const audience = (value: string) =>
		container.querySelector<HTMLInputElement>(`[role="radiogroup"][aria-label="Audience"] input[value="${value}"]`)!
	const region = () =>
		[...container.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')].find((el) =>
			el.textContent!.startsWith('European Union')
		)
	expect(audience('global').checked).toBe(true)
	expect(region()).toBeUndefined()
	await act(async () => {
		audience('global').focus()
		audience('global').dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
		)
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
	await waitForUi(() => expect(audience('selected').checked).toBe(true))
	expect(document.activeElement).toBe(audience('selected'))
	expect(region()!.getAttribute('aria-checked')).toBe('false')
	await act(async () => region()!.click())
	expect(region()!.getAttribute('aria-checked')).toBe('true')
	await act(async () => region()!.click())
	expect(region()!.getAttribute('aria-checked')).toBe('false')
})
