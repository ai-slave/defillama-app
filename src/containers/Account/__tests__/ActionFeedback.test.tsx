// @vitest-environment happy-dom
import { useMutation } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { ResearchSponsorsAdminView } from '~/containers/Articles/admin/ResearchSponsorsAdminView'
import { TrustedByAdminView } from '~/containers/Articles/admin/TrustedByAdminView'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ApiAccessCard } from '../ApiAccessCard'

const session = installSubscriberSession('admin')
const features = (path: string) => `${FEATURES_SERVER.replace(/\/$/, '')}${path}`
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
		[features('/research/sponsors')]: () => ({ sponsors }),
		[features('/research/sponsors/')]: () => next(sponsorUpdates),
		[features('/research/trusted-by/logos')]: () => logosReply(),
		[features('/research/trusted-by/mentions')]: {
			mentions: [{ id: 'm1', username: 'example', quote: 'A useful tool', enabled: false }]
		},
		[features('/research/trusted-by/logos/l1')]: () => next(deletions),
		[features('/research/trusted-by/mentions/m1')]: () => next(deletions),
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
	return (
		<ApiAccessCard
			apiKey={key}
			credits={null}
			usageStats={null}
			isUsageStatsLoading={false}
			isUsageStatsError={false}
			generateNewKeyMutation={generation}
		/>
	)
}
test('copy reports success only after the clipboard accepts the key and retries a rejection', async () => {
	const request = Promise.withResolvers<void>()
	copy.mockReturnValueOnce(request.promise).mockResolvedValueOnce(undefined)
	await mount(<ApiHarness />)
	await click('Copy')
	await waitForUi(() => expect(button('Copying…').disabled).toBe(true))
	expect(container.textContent).not.toContain('Copied')
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
test('first key generation needs no destructive confirmation and exposes retry feedback', async () => {
	regenerate.mockRejectedValueOnce(new Error('Try again')).mockResolvedValueOnce('first-test-key')
	await mount(<ApiHarness initialKey={null} />)
	await click('Generate API Key')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Try again'))
	expect(dialog()).toBeUndefined()
	await click('Generate API Key')
	await waitForUi(() => expect(button('Show API key')).toBeDefined())
})
async function selectReplacement(sponsorId: string, slug: string) {
	const input = document.querySelector<HTMLInputElement>(`#replacement-${sponsorId}`)!
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

test('an old sponsor update cannot close a reopened editor or clear its new selection', async () => {
	const first = pending()
	sponsorUpdates.push(first.answer)
	await mount(<ResearchSponsorsAdminView />)
	await waitForUi(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await click('Save page')
	await click('Cancel edit')
	await click('Change page')
	await selectReplacement('s1', 'second')
	await act(async () => first.reply.resolve({}))
	expect(document.querySelector('#replacement-s1')).not.toBeNull()
	expect(button('Save page').disabled).toBe(false)
	await click('Save page')
	await waitForUi(() => expect(document.querySelector('#replacement-s1')).toBeNull())
	expect(sponsorUpdateBodies()).toEqual([
		['s1', 'new'],
		['s1', 'second']
	])
})
test.each(['success', 'failure'] as const)(
	'a reopened sponsor save waits for the previous request to settle with %s',
	async (outcome) => {
		const first = pending()
		const second = pending()
		sponsorUpdates.push(first.answer, second.answer)
		await mount(<ResearchSponsorsAdminView />)
		await waitForUi(() => expect(button('Change page')).toBeDefined())
		await click('Change page')
		await selectReplacement('s1', 'new')
		await click('Save page')
		await waitForUi(() => expect(sponsorUpdateBodies()).toHaveLength(1))
		await click('Cancel edit')
		await click('Change page')
		await selectReplacement('s1', 'second')
		await click('Save page')
		await waitForUi(() => expect(button('Saving…').getAttribute('aria-disabled')).toBe('true'))
		expect(sponsorUpdateBodies()).toHaveLength(1)
		await act(async () => first.reply.resolve(outcome === 'success' ? {} : offline()))
		await waitForUi(() =>
			expect(sponsorUpdateBodies()).toEqual([
				['s1', 'new'],
				['s1', 'second']
			])
		)
		expect(document.querySelector('#replacement-s1')).not.toBeNull()
		expect(document.querySelector('[role="alert"]')).toBeNull()
		await act(async () => second.reply.resolve({}))
		await waitForUi(() => expect(document.querySelector('#replacement-s1')).toBeNull())
	}
)

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
	await waitForUi(() => expect(document.querySelector('#replacement-s2')).toBeNull())
	expect(document.querySelector('#replacement-s1')).not.toBeNull()
	await act(async () => first.reply.resolve({}))
	await waitForUi(() => expect(document.querySelector('#replacement-s1')).toBeNull())
})

test('sponsor save failure preserves the selected page and retries inline', async () => {
	sponsorUpdates.push(offline)
	await mount(<ResearchSponsorsAdminView />)
	await waitForUi(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await click('Save page')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Offline'))
	expect(document.querySelector('#replacement-s1')).not.toBeNull()
	await click('Save page')
	await waitForUi(() => expect(document.querySelector('#replacement-s1')).toBeNull())
})
test('sponsor deletion removes the row and restores focus to the surviving heading', async () => {
	sponsorUpdates.push(() => {
		sponsors = []
		return {}
	})
	await mount(<ResearchSponsorsAdminView />)
	await waitForUi(() => expect(button('Remove')).toBeDefined())
	await click('Remove')
	await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
	const confirm = [...dialog()!.querySelectorAll('button')].find((el) => accessibleName(el) === 'Remove')!
	await act(async () => confirm.click())
	await waitForUi(() => expect(container.textContent).not.toContain('Original sponsor'))
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Sponsored reports'))
	expect(deletedPaths()).toEqual(['/research/sponsors/s1'])
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

test('deletion stays pending through the list refresh before restoring focus after its row disappears', async () => {
	const refreshed = Promise.withResolvers<unknown>()
	deletions.push(() => {
		logosReply = () => refreshed.promise
		return {}
	})
	await mount(<TrustedByAdminView />)
	await waitForUi(() => expect(button('Delete Example logo')).toBeDefined())
	await click('Delete Example logo')
	await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Delete')
	await waitForUi(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await act(async () => refreshed.resolve({ logos: [] }))
	await waitForUi(() => expect(dialog()).toBeUndefined())
	await waitForUi(() => expect(document.activeElement?.textContent).toBe('Trusted By'))
})
