// @vitest-environment happy-dom
import { useMutation, useQuery } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { ResearchSponsorsAdminView } from '~/containers/Articles/admin/ResearchSponsorsAdminView'
import { TrustedByAdminView } from '~/containers/Articles/admin/TrustedByAdminView'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fieldErrorOf } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ApiAccessCard } from '../ApiAccessCard'
import type { ApiUsageStats } from '../ApiUsageBreakdown'

const session = installSubscriberSession('admin')

const copy = vi.fn<(text: string) => Promise<void>>()
const regenerate = vi.fn<() => Promise<string>>()
type Reply = () => unknown
/** Replies for the next mutation requests, in order; an empty queue answers `{}`. */
let sponsorUpdates: Array<Reply>
let deletions: Array<Reply>
let logosReply: Reply
let sponsors: Array<object>
const sponsorUpdateBodies = () =>
	session.requests
		.filter((request) => request.init?.method === 'PATCH')
		.map((request) => [request.url.pathname.split('/').at(-1), JSON.parse(String(request.init!.body)).entitySlug])
const deletedPaths = () =>
	session.requests.filter((request) => request.init?.method === 'DELETE').map((request) => request.url.pathname)
const next = (queue: Array<Reply>) => (queue.shift() ?? (() => ({})))()
const entity = (slug: string, label: string) => ({
	id: `protocol:${slug}`,
	entityType: 'protocol',
	slug,
	label,
	route: `/protocol/${slug}`,
	source: 'search'
})

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	copy.mockReset()
	regenerate.mockReset()
	sponsorUpdates = []
	deletions = []
	sponsors = [
		{ id: 's1', displayName: 'Original sponsor', entityType: 'protocol', entitySlug: 'original', reports: [] }
	]
	const logos = [
		{ id: 'l1', name: 'Example logo', linkUrl: 'https://example.com', imageUrl: '/test.svg', enabled: false }
	]
	logosReply = () => ({ logos })
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[`${FEATURES_SERVER}/research/sponsors`]: () => ({ sponsors }),
		[`${FEATURES_SERVER}/research/sponsors/`]: () => next(sponsorUpdates),
		[`${FEATURES_SERVER}/research/trusted-by/logos`]: () => logosReply(),
		[`${FEATURES_SERVER}/research/trusted-by/mentions`]: {
			mentions: [{ id: 'm1', username: 'example', quote: 'A useful tool', enabled: false }]
		},
		[`${FEATURES_SERVER}/research/trusted-by/logos/l1`]: () => next(deletions),
		[`${FEATURES_SERVER}/research/trusted-by/mentions/m1`]: () => next(deletions),
		'/api/private/research/revalidate-landing': {},
		'/api/public/research/entities/search': {
			entities: [entity('new', 'New sponsor'), entity('second', 'Second sponsor')]
		}
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	vi.stubGlobal('navigator', { clipboard: { writeText: copy }, userAgent: 'test' })
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})
async function mount(element: React.ReactNode) {
	await act(async () => root.render(<session.Wrapper>{element}</session.Wrapper>))
}
function button(name: string) {
	const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)
	expect(result).toBeDefined()
	return result!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
function dialog() {
	return [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].find((el) => !el.hidden)
}
function ApiHarness({ initialKey = 'old-test-key' }: { initialKey?: string | null }) {
	const [key, setKey] = useState(initialKey)
	const generation = useMutation({
		mutationFn: () => regenerate(),
		onSuccess: (generatedKey) => setKey(generatedKey)
	})
	// Never runs: the card shows no usage yet, as for an account whose stats have not been read.
	const usageStatsQuery = useQuery<ApiUsageStats | null>({
		queryKey: ['usage-stats'],
		queryFn: () => null,
		enabled: false
	})
	return (
		<ApiAccessCard apiKey={key} credits={null} usageStatsQuery={usageStatsQuery} generateNewKeyMutation={generation} />
	)
}
test('copy reports success only after the clipboard accepts the key and retries a rejection', async () => {
	const request = Promise.withResolvers<void>()
	copy.mockReturnValueOnce(request.promise).mockResolvedValueOnce(undefined)
	await mount(<ApiHarness />)
	await click('Copy')
	await waitForUi(() => expect(button('Copying…').getAttribute('aria-disabled')).toBe('true'))
	// The done label is laid out but hidden until the copy succeeds, so no button is named Copied yet.
	expect([...container.querySelectorAll('button')].some((el) => accessibleName(el) === 'Copied')).toBe(false)
	await act(async () => request.reject(new Error('Permission denied')))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not copy'))
	await click('Copy')
	await waitForUi(() => expect(button('Copied')).toBeDefined())
	expect(copy).toHaveBeenCalledWith('old-test-key')
})
test('each successful copy gets a fresh feedback interval, while a later failure stays visible', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
	copy.mockResolvedValue(undefined)
	await mount(<ApiHarness />)
	await click('Copy')
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(button('Copied')).toBeDefined()
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1000)
	})
	await click('Copied')
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1)
	})
	expect(copy).toHaveBeenCalledTimes(2)
	// Cross the first copy's expiry while the second copy should still show success.
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1100)
	})
	expect(button('Copied')).toBeDefined()
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1000)
	})
	expect(button('Copy')).toBeDefined()
	await click('Copy')
	await act(async () => {
		await vi.advanceTimersByTimeAsync(1)
	})
	copy.mockRejectedValueOnce(new Error('Permission denied'))
	await click('Copied')
	await act(async () => {
		await vi.advanceTimersByTimeAsync(2100)
	})
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not copy')
})
test('regeneration keeps confirmation and old key on failure, retries, and closes on success', async () => {
	const request = Promise.withResolvers<string>()
	regenerate.mockReturnValueOnce(request.promise).mockResolvedValueOnce('new-test-key')
	await mount(<ApiHarness />)
	await click('Regenerate')
	await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Cancel')
	expect(regenerate).not.toHaveBeenCalled()
	await click('Regenerate')
	const confirm = [...dialog()!.querySelectorAll('button')].find((el) => accessibleName(el) === 'Regenerate')!
	await act(async () => confirm.click())
	await waitForUi(() => expect(confirm.getAttribute('aria-disabled')).toBe('true'))
	await act(async () => confirm.click())
	expect(regenerate).toHaveBeenCalledOnce()
	await act(async () => request.reject(new Error('Generation refused')))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Generation refused'))
	await act(async () => confirm.click())
	await waitForUi(() => expect(dialog()).toBeUndefined())
	await click('Show API key')
	expect(container.textContent).toContain('new-test-key')
})
test('first key generation needs no destructive confirmation and keeps its failure on screen while it retries', async () => {
	const retry = Promise.withResolvers<string>()
	regenerate.mockRejectedValueOnce(new Error('Try again')).mockReturnValueOnce(retry.promise)
	await mount(<ApiHarness initialKey={null} />)
	await click('Generate API key')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Try again'))
	expect(dialog()).toBeUndefined()
	await click('Generate API key')
	await waitForUi(() => expect(button('Generating…').getAttribute('aria-busy')).toBe('true'))
	expect(document.querySelector('[role="alert"]')?.textContent).toBe('Try again')
	await act(async () => retry.resolve('first-test-key'))
	await waitForUi(() => expect(button('Show API key')).toBeDefined())
})
test('first key generation keeps focus on Generate while it runs, then hands it to the new key', async () => {
	const request = Promise.withResolvers<string>()
	regenerate.mockReturnValueOnce(request.promise)
	await mount(<ApiHarness initialKey={null} />)
	const generate = button('Generate API key')
	await act(async () => generate.focus())
	await act(async () => generate.click())
	await waitForUi(() => expect(accessibleName(generate)).toBe('Generating…'))
	// happy-dom keeps focus on a natively disabled button, so the contract is that the button never becomes one.
	expect(generate.disabled).toBe(false)
	expect(document.activeElement).toBe(generate)
	await act(async () => request.resolve('first-test-key'))
	await waitForUi(() => expect(document.activeElement).toBe(button('Show API key')))
})
// The open page editor's field in the sponsor's card, found by its visible label.
function replacementInput(sponsorId: string) {
	const { displayName } = sponsors.find((sponsor) => (sponsor as { id: string }).id === sponsorId) as {
		displayName: string
	}
	const card = [...document.querySelectorAll('section')].find(
		(el) => el.querySelector('h2')?.textContent === displayName
	)!
	const label = [...card.querySelectorAll('label')].find((el) => el.textContent === 'Replacement DefiLlama page')
	return label ? (document.getElementById(label.htmlFor) as HTMLInputElement) : null
}
async function selectReplacement(sponsorId: string, slug: string) {
	const input = replacementInput(sponsorId)!
	await act(async () => {
		input.focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'New')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await waitForUi(() => expect(document.querySelector('[role="option"]')).not.toBeNull())
	await act(async () =>
		[...document.querySelectorAll<HTMLElement>('[role="option"]')]
			.find((option) => option.textContent?.includes(`/protocol/${slug}`))!
			.click()
	)
}
const pending = () => {
	const reply = Promise.withResolvers<unknown>()
	return { reply, answer: () => reply.promise }
}
const offline = () => fixtureStatus(500, { error: 'Offline' })()

test('Cancel edit waits while a sponsor save runs, so its failure shows in the editor', async () => {
	const first = pending()
	sponsorUpdates.push(first.answer)
	await mount(<ResearchSponsorsAdminView />)
	await waitForUi(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await click('Save page')
	await waitForUi(() => expect(button('Cancel edit').getAttribute('aria-disabled')).toBe('true'))
	await click('Cancel edit')
	expect(replacementInput('s1')).not.toBeNull()
	await act(async () => first.reply.resolve(offline()))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Offline'))
	expect(button('Cancel edit').getAttribute('aria-disabled')).toBeNull()
})

test('a saved sponsor page closes its editor and hands focus to Change page', async () => {
	sponsorUpdates.push(() => ({}))
	await mount(<ResearchSponsorsAdminView />)
	await waitForUi(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await act(async () => {
		button('Save page')!.focus()
		button('Save page')!.click()
	})
	await waitForUi(() => expect(replacementInput('s1')).toBeNull())
	expect(document.activeElement).toBe(button('Change page'))
	expect(button('Change page')!.getAttribute('aria-expanded')).toBe('false')
})
test('a pending sponsor save does not block saving another sponsor', async () => {
	const first = pending()
	sponsorUpdates.push(first.answer)
	sponsors = [
		{ id: 's1', displayName: 'First', entityType: 'protocol', entitySlug: 'first', reports: [] },
		{ id: 's2', displayName: 'Second', entityType: 'protocol', entitySlug: 'second', reports: [] }
	]
	await mount(<ResearchSponsorsAdminView />)
	await waitForUi(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await click('Save page')
	await waitForUi(() => expect(sponsorUpdateBodies()).toHaveLength(1))
	await click('Change page')
	await selectReplacement('s2', 'second')
	await click('Save page')
	await waitForUi(() =>
		expect(sponsorUpdateBodies()).toEqual([
			['s1', 'new'],
			['s2', 'second']
		])
	)
	await waitForUi(() => expect(replacementInput('s2')).toBeNull())
	expect(replacementInput('s1')).not.toBeNull()
	await act(async () => first.reply.resolve({}))
	await waitForUi(() => expect(replacementInput('s1')).toBeNull())
})

test('sponsor save failure preserves the selected page and retries inline', async () => {
	sponsorUpdates.push(offline)
	await mount(<ResearchSponsorsAdminView />)
	await waitForUi(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await click('Save page')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Offline'))
	expect(replacementInput('s1')).not.toBeNull()
	await click('Save page')
	await waitForUi(() => expect(replacementInput('s1')).toBeNull())
})
test('picking a Research article keeps focus on the article search while the link saves', async () => {
	const link = pending()
	sponsorUpdates.push(link.answer)
	session.serve({
		[`${FEATURES_SERVER}/research/sponsors/articles`]: {
			articles: [
				{ id: 'r1', title: 'Linkable report', slug: 'linkable', section: 'report', lifecycleStatus: 'published' }
			]
		}
	})
	await mount(<ResearchSponsorsAdminView />)
	const search = await waitForUi(() => {
		const input = document.querySelector<HTMLInputElement>('input[aria-label="Research article to link"]')
		expect(input).not.toBeNull()
		return input!
	})
	await act(async () => {
		search.focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Link')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await waitForUi(() => expect(document.querySelector('[role="option"]')).not.toBeNull())
	await act(async () => document.querySelector<HTMLElement>('[role="option"]')!.click())
	await waitForUi(() => expect(search.getAttribute('aria-disabled')).toBe('true'))
	// A browser drops focus from a natively disabled field; happy-dom does not, so the field must stay enabled.
	expect(search.disabled).toBe(false)
	expect(document.activeElement).toBe(search)
	await act(async () => link.reply.resolve({}))
	await waitForUi(() => expect(search.getAttribute('aria-disabled')).toBeNull())
	expect(document.activeElement).toBe(search)
})
test('a trusted logo toggle keeps focus on its checkbox while it saves', async () => {
	const save = pending()
	deletions.push(save.answer)
	await mount(<TrustedByAdminView />)
	const toggle = await waitForUi(() => {
		const box = document.querySelector<HTMLInputElement>('input[type="checkbox"]')
		expect(box).not.toBeNull()
		return box!
	})
	await act(async () => {
		toggle.focus()
		toggle.click()
	})
	await waitForUi(() => expect(toggle.getAttribute('aria-disabled')).toBe('true'))
	// A browser drops focus from a natively disabled box; happy-dom does not, so the box must stay enabled.
	expect(toggle.disabled).toBe(false)
	expect(document.activeElement).toBe(toggle)
	await act(async () => save.reply.resolve({ logo: {} }))
	await waitForUi(() => expect(toggle.getAttribute('aria-disabled')).toBeNull())
})
test('sponsor deletion removes the row and hands focus to the page content', async () => {
	sponsorUpdates.push(() => {
		sponsors = []
		return {}
	})
	await mount(
		<main>
			<ResearchSponsorsAdminView />
		</main>
	)
	await waitForUi(() => expect(button('Remove')).toBeDefined())
	await click('Remove')
	await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
	const confirm = [...dialog()!.querySelectorAll('button')].find((el) => accessibleName(el) === 'Remove')!
	await act(async () => confirm.click())
	await waitForUi(() => expect(container.textContent).not.toContain('Original sponsor'))
	await waitForUi(() => expect(document.activeElement?.tagName).toBe('MAIN'))
})
test.each([
	['Delete Example logo', '/research/trusted-by/logos/l1'],
	['Delete mention example', '/research/trusted-by/mentions/m1']
] as const)('%s retries after a failure and sends only the selected deletion', async (name, path) => {
	deletions.push(() => fixtureStatus(500, { error: 'Retry deletion' })())
	await mount(<TrustedByAdminView />)
	await waitForUi(() => expect(button(name)).toBeDefined())
	await click(name)
	await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Delete')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Retry deletion'))
	await click('Delete')
	await waitForUi(() => expect(dialog()).toBeUndefined())
	expect(deletedPaths()).toEqual([path, path])
})

test('deletion stays pending through the list refresh, then hands focus to Add logo once its row disappears', async () => {
	const refreshed = Promise.withResolvers<unknown>()
	deletions.push(() => {
		logosReply = () => refreshed.promise
		return {}
	})
	await mount(
		<main>
			<TrustedByAdminView />
		</main>
	)
	await waitForUi(() => expect(button('Delete Example logo')).toBeDefined())
	await click('Delete Example logo')
	await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Delete')
	await waitForUi(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await act(async () => refreshed.resolve({ logos: [] }))
	await waitForUi(() => expect(dialog()).toBeUndefined())
	await waitForUi(() => expect(document.activeElement?.textContent?.trim()).toBe('Add logo'))
})
test('Add client with no page picked marks the page search invalid, describes it by its error, and focuses it', async () => {
	await mount(<ResearchSponsorsAdminView />)
	await waitForUi(() => expect(button('Add client')).toBeDefined())
	await click('Add client')
	const label = [...document.querySelectorAll('label')].find((el) => el.textContent === 'DefiLlama page')!
	const search = document.getElementById(label.htmlFor)!
	expect(search.getAttribute('aria-invalid')).toBe('true')
	expect(fieldErrorOf(search)).toBe('Choose a DefiLlama page.')
	expect(document.activeElement).toBe(search)
})
