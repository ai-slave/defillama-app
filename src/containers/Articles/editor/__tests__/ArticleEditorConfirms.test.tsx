// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts, fieldErrorOf, fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { createEmptyLocalArticle } from '../../document'
import type { ArticleCollaborator, ArticleDocument, ArticleSnapshotPayload } from '../../types'
import { ArticleEditorClient } from '../ArticleEditorClient'

const ARTICLE_NOW = '2026-07-14T00:00:00.000Z'

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
const router = vi.hoisted(() => ({
	query: {},
	asPath: '/research/edit/test-article',
	replace: vi.fn(),
	events: { on: vi.fn(), off: vi.fn() }
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
vi.mock('react-hot-toast', () => ({
	default: { error: toasts.error, success: toasts.success, promise: (pending: Promise<unknown>) => pending }
}))
const session = installSubscriberSession('article-editor')

const coAuthor: ArticleCollaborator = {
	pbUserId: 'co-author',
	profile: {
		id: 'sam',
		pbUserId: 'co-author',
		slug: 'sam',
		displayName: 'Sam',
		socials: {},
		createdAt: '',
		updatedAt: ''
	},
	role: 'collaborator',
	addedAt: '2026-09-01T00:00:00Z',
	addedByPbUserId: null,
	hidden: false
}

let article: ArticleDocument
let root: Root
let container: HTMLDivElement
let collaborators: Array<ArticleCollaborator>
let articleWrite: () => Response | ArticleDocument | Promise<Response> | object
let publishWrite: () => Response | Promise<Response>
beforeEach(() => {
	vi.resetAllMocks()
	article = {
		...createEmptyLocalArticle(ARTICLE_NOW),
		id: 'test-article',
		title: 'Saved headline',
		slug: 'test-article',
		viewerRole: 'owner',
		section: 'spotlight',
		tags: ['defi'],
		displayDate: '2026-09-06T00:00:00Z',
		coverImage: { url: '/cover.png', caption: 'Cover', copyright: 'Author', credit: 'Author' },
		authorProfile: { slug: 'author', displayName: 'Author', socials: {}, createdAt: '', updatedAt: '' }
	}
	collaborators = [coAuthor]
	articleWrite = fixtureStatus(500, { error: 'Server unavailable' })
	publishWrite = fixtureStatus(500, { error: 'Publish unavailable' })
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[`${FEATURES_SERVER}/articles/`]: (url: URL) => {
			if (url.pathname.endsWith('/edit')) return { article }
			if (url.pathname.endsWith('/collaborators')) return { collaborators }
			return articleWrite()
		},
		'http://localhost:3000/api/private/research/articles/': () => publishWrite(),
		'/api/private/research/revalidate-landing': {}
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function mount() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AppMetadataProvider>
					<ArticleEditorClient articleId="test-article" />
				</AppMetadataProvider>
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(document.querySelector('[aria-label="Article title"]')).not.toBeNull())
}
function button(name: string, scope: ParentNode = document) {
	const result = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
		(x) => accessibleName(x).replace(/\s*[→▾]$/, '') === name
	)
	if (!result) throw new Error(`Missing button: ${name}`)
	return result
}
function openDialog(title: string) {
	const dialog = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')].find(
		(x) => !x.hidden && x.querySelector('h2')?.textContent === title
	)
	if (!dialog) throw new Error(`Missing dialog: ${title}`)
	return dialog
}
async function click(target: HTMLElement) {
	await act(async () => target.click())
}
/** Clicks as a keyboard or pointer user does: the control takes focus first. */
async function press(target: HTMLElement) {
	await act(async () => {
		target.focus()
		target.click()
	})
}
test('a failed delete keeps its confirm open with the error, and no toast', async () => {
	await mount()
	await click(button('Delete draft'))
	await waitForUi(() => expect(openDialog('Delete this draft?')).toBeTruthy())
	await click(button('Delete', openDialog('Delete this draft?')))
	await waitForUi(() => expect(alertTexts(openDialog('Delete this draft?'))).toHaveLength(1))
	expect(toasts.error).not.toHaveBeenCalled()
	expect(router.replace).not.toHaveBeenCalled()
})

test('discarding pending changes asks first and shows a failure inside the confirm', async () => {
	article = {
		...article,
		status: 'published',
		pending: { ...article, title: 'Pending headline' } as ArticleSnapshotPayload
	}
	await mount()
	await click(button('Discard'))
	await waitForUi(() => expect(openDialog('Discard pending changes?')).toBeTruthy())
	await click(button('Discard changes', openDialog('Discard pending changes?')))
	await waitForUi(() => expect(alertTexts(openDialog('Discard pending changes?'))).toHaveLength(1))
	expect(toasts.error).not.toHaveBeenCalled()
})

test('a failed co-author removal says so in the authors list, not on the add field or in a toast', async () => {
	await mount()
	await click(button('Publish'))
	await waitForUi(() => expect(button('Remove Sam')).toBeTruthy())
	await click(button('Remove Sam'))
	const review = openDialog('Review & publish')
	await waitForUi(() => expect(alertTexts(review)).toHaveLength(1))
	const email = review.querySelector<HTMLInputElement>('input[type="email"]')!
	expect(email.getAttribute('aria-invalid')).toBeNull()
	expect(document.getElementById(email.getAttribute('aria-describedby')!)!.textContent).toBe(
		'Co-authors can edit, publish, and unpublish. Only you can manage authors or delete.'
	)
	expect(toasts.error).not.toHaveBeenCalled()
})

test('reopening the review starts without the last opening’s co-author error', async () => {
	await mount()
	await click(button('Publish'))
	await waitForUi(() => expect(button('Remove Sam')).toBeTruthy())
	await click(button('Remove Sam'))
	await waitForUi(() => expect(alertTexts(openDialog('Review & publish'))).toHaveLength(1))
	await click(button('Close dialog', openDialog('Review & publish')))
	await waitForUi(() =>
		expect(document.querySelector('[role="dialog"]:not([hidden]) h2')?.textContent).not.toBe('Review & publish')
	)
	await click(button('Publish'))
	await waitForUi(() => expect(button('Remove Sam')).toBeTruthy())
	expect(alertTexts(openDialog('Review & publish'))).toEqual([])
})

test('making a co-author the owner asks first and shows a failed transfer in the confirm', async () => {
	await mount()
	await click(button('Publish'))
	await waitForUi(() => expect(button('Make owner')).toBeTruthy())
	await click(button('Make owner'))
	await waitForUi(() => expect(openDialog('Make Sam the owner?')).toBeTruthy())
	await click(button('Make owner', openDialog('Make Sam the owner?')))
	await waitForUi(() => expect(alertTexts(openDialog('Make Sam the owner?'))).toHaveLength(1))
	expect(openDialog('Review & publish')).toBeTruthy()
	expect(toasts.error).not.toHaveBeenCalled()
})

test('a made owner closes the confirm onto the authors list, since the Make owner control is gone', async () => {
	articleWrite = () => ({ article: { ...article, viewerRole: 'collaborator' } })
	await mount()
	await click(button('Publish'))
	await waitForUi(() => expect(button('Make owner')).toBeTruthy())
	await press(button('Make owner'))
	await waitForUi(() => expect(openDialog('Make Sam the owner?')).toBeTruthy())
	await click(button('Make owner', openDialog('Make Sam the owner?')))
	await waitForUi(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Authors'))
	expect(openDialog('Review & publish').querySelector('[aria-label="Remove Sam"]')).toBeNull()
})

test('removing the only co-author hands focus to the add field once the request succeeds', async () => {
	articleWrite = () => {
		collaborators = []
		return {}
	}
	await mount()
	await click(button('Publish'))
	await waitForUi(() => expect(button('Remove Sam')).toBeTruthy())
	await press(button('Remove Sam'))
	const review = openDialog('Review & publish')
	await waitForUi(() => expect(review.querySelector('[aria-label="Remove Sam"]')).toBeNull())
	expect(document.activeElement).toBe(review.querySelector('input[type="email"]'))
})

test('removing a guest co-author hands focus to the row that takes its place, then to Add guest co-author', async () => {
	await mount()
	await click(button('Publish'))
	const review = openDialog('Review & publish')
	await click(button('Add guest co-author', review))
	await click(button('Add guest co-author', review))
	await press(button('Remove guest co-author 1', review))
	expect(document.activeElement).toBe(button('Remove guest co-author 1', review))
	await press(button('Remove guest co-author 1', review))
	expect(document.activeElement).toBe(button('Add guest co-author', review))
})

test('a guest co-author starts as a Person and picking Organization moves the one checked type', async () => {
	await mount()
	await click(button('Publish'))
	const review = openDialog('Review & publish')
	await click(button('Add guest co-author', review))
	const group = review.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Co-author type"]')!
	const checked = () =>
		[...group.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
			.filter((radio) => radio.checked)
			.map((radio) => radio.closest('label')!.textContent)
	expect(checked()).toEqual(['Person'])
	await click(group.querySelector<HTMLInputElement>('input[value="Organization"]')!)
	expect(checked()).toEqual(['Organization'])
})

test('publishing from the page with a missing field opens the review that marks it', async () => {
	article = { ...article, status: 'published', tags: [], pending: { ...article, tags: [] } as ArticleSnapshotPayload }
	await mount()
	await click(button('Publish update'))
	await waitForUi(() => expect(fieldErrorTexts(openDialog('Edit listing'))).toHaveLength(1))
	expect(toasts.error).not.toHaveBeenCalled()
})

test('a co-author removal keeps the sheet open until it settles, then shows its failure there', async () => {
	const held = Promise.withResolvers<Response>()
	articleWrite = () => held.promise
	await mount()
	await click(button('Publish'))
	await waitForUi(() => expect(button('Remove Sam')).toBeTruthy())
	await click(button('Remove Sam'))
	const review = openDialog('Review & publish')
	await waitForUi(() => expect(button('Remove Sam').getAttribute('aria-busy')).toBe('true'))
	await act(async () =>
		review.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
	await click(button('Close dialog', review))
	await click(button('Keep editing', review))
	expect(review.hidden).toBe(false)
	await act(async () => held.resolve(fixtureStatus(500)()))
	await waitForUi(() => expect(alertTexts(review)).toHaveLength(1))
	expect(toasts.error).not.toHaveBeenCalled()
})

test('a publish that fails after the reader left the editor reports it in a toast', async () => {
	const held = Promise.withResolvers<Response>()
	publishWrite = () => held.promise
	await mount()
	await click(button('Publish'))
	await click(button('Publish now', openDialog('Review & publish')))
	await waitForUi(() => expect(button('Publishing…')).toBeTruthy())
	await act(async () => root.unmount())
	root = createRoot(container)
	await act(async () => held.resolve(fixtureStatus(500, { error: 'Publish unavailable' })()))
	await waitForUi(() => expect(toasts.error).toHaveBeenCalledOnce())
	// A 5xx body is not written for readers.
	expect(toasts.error).not.toHaveBeenCalledWith('Publish unavailable')
})

test('a co-author removal that fails after the reader left the editor reports it in a toast', async () => {
	const held = Promise.withResolvers<Response>()
	articleWrite = () => held.promise
	await mount()
	await click(button('Publish'))
	await waitForUi(() => expect(button('Remove Sam')).toBeTruthy())
	await click(button('Remove Sam'))
	await act(async () => root.unmount())
	root = createRoot(container)
	await act(async () => held.resolve(fixtureStatus(500)()))
	await waitForUi(() => expect(toasts.error).toHaveBeenCalledWith(expect.any(String)))
})

test('making a co-author the owner keeps the edits not saved yet', async () => {
	articleWrite = () => ({ article: { ...article, viewerRole: 'collaborator' } })
	await mount()
	const title = document.querySelector<HTMLTextAreaElement>('[aria-label="Article title"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(title, 'Unsaved headline')
		title.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await click(button('Publish'))
	await waitForUi(() => expect(button('Make owner')).toBeTruthy())
	await click(button('Make owner'))
	await click(button('Make owner', openDialog('Make Sam the owner?')))
	await waitForUi(() => expect(openDialog('Review & publish').querySelector('[aria-label="Remove Sam"]')).toBeNull())
	expect(title.value).toBe('Unsaved headline')
})

async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('publishing without a topic marks Topics, focuses it, and the mark clears once a topic is typed', async () => {
	article = { ...article, tags: [] }
	await mount()
	await click(button('Publish'))
	const review = openDialog('Review & publish')
	const topics = review.querySelector<HTMLInputElement>('input[placeholder="stablecoins, lending, ethereum"]')!
	expect(fieldErrorOf(topics)).toBeNull()
	await press(button('Publish now', review))
	await waitForUi(() => expect(document.activeElement).toBe(topics))
	expect(fieldErrorOf(topics)).toBeTruthy()
	await type(topics, 'lending')
	expect(fieldErrorOf(topics)).toBeNull()
})

test('adding a co-author checks the address under its field and sends nothing until it looks valid', async () => {
	await mount()
	await click(button('Publish'))
	const review = openDialog('Review & publish')
	await waitForUi(() => expect(button('Remove Sam')).toBeTruthy())
	const email = review.querySelector<HTMLInputElement>('input[type="email"]')!
	await press(button('Add', review))
	expect(fieldErrorOf(email)).toBe('Enter an email address.')
	expect(document.activeElement).toBe(email)
	await type(email, 'sam@example')
	expect(fieldErrorOf(email)).toBe('Enter a valid email address.')
	expect(
		session.requests.some(
			(request) => request.url.pathname.endsWith('/collaborators') && request.init?.method === 'POST'
		)
	).toBe(false)
})

test('an address the server refuses says so under the email field, takes focus, and clears on the next edit', async () => {
	await mount()
	session.serve({
		[`${FEATURES_SERVER}/articles/`]: (url: URL, init?: RequestInit) => {
			if (url.pathname.endsWith('/collaborators') && init?.method === 'POST') {
				return fixtureStatus(404, { error: 'No account uses that email.' })()
			}
			if (url.pathname.endsWith('/edit')) return { article }
			if (url.pathname.endsWith('/collaborators')) return { collaborators }
			return articleWrite()
		}
	})
	await click(button('Publish'))
	const review = openDialog('Review & publish')
	await waitForUi(() => expect(button('Remove Sam')).toBeTruthy())
	const email = review.querySelector<HTMLInputElement>('input[type="email"]')!
	await type(email, 'nobody@example.com')
	await press(button('Add', review))
	await waitForUi(() => expect(fieldErrorOf(email)).toBe('No account uses that email.'))
	expect(document.activeElement).toBe(email)
	await type(email, 'somebody@example.com')
	expect(fieldErrorOf(email)).toBeNull()
})
