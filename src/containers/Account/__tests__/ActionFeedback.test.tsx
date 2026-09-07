// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ResearchSponsorsAdminView } from '~/containers/Articles/admin/ResearchSponsorsAdminView'
import { TrustedByAdminView } from '~/containers/Articles/admin/TrustedByAdminView'
import { ApiAccessCard } from '../ApiAccessCard'

const api = vi.hoisted(() => ({
	update: vi.fn(),
	sponsors: vi.fn(),
	removeSponsor: vi.fn(),
	logos: vi.fn(),
	mentions: vi.fn(),
	removeLogo: vi.fn(),
	removeMention: vi.fn(),
	copy: vi.fn(),
	regenerate: vi.fn(),
	error: vi.fn()
}))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ isAuthenticated: true, authorizedFetch: vi.fn() }) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: api.error } }))
vi.mock('~/containers/Articles/api', async (original) => ({
	...(await original<typeof import('~/containers/Articles/api')>()),
	listResearchSponsors: api.sponsors,
	updateResearchSponsor: api.update,
	deleteResearchSponsor: api.removeSponsor,
	listTrustedLogos: api.logos,
	listSocialMentions: api.mentions,
	deleteTrustedLogo: api.removeLogo,
	deleteSocialMention: api.removeMention,
	revalidateResearchLanding: async () => {}
}))
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	vi.resetAllMocks()
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	vi.stubGlobal('navigator', { clipboard: { writeText: api.copy }, userAgent: 'test' })
	api.sponsors.mockResolvedValue([
		{ id: 's1', displayName: 'Original sponsor', entityType: 'protocol', entitySlug: 'original', reports: [] }
	])
	api.logos.mockResolvedValue([
		{ id: 'l1', name: 'Example logo', linkUrl: 'https://example.com', imageUrl: '/test.svg', enabled: false }
	])
	api.mentions.mockResolvedValue([{ id: 'm1', username: 'example', quote: 'A useful tool', enabled: false }])
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						entities: [
							{
								id: 'protocol:new',
								entityType: 'protocol',
								slug: 'new',
								label: 'New sponsor',
								route: '/protocol/new',
								source: 'search'
							},
							{
								id: 'protocol:second',
								entityType: 'protocol',
								slug: 'second',
								label: 'Second sponsor',
								route: '/protocol/second',
								source: 'search'
							}
						]
					}),
					{ status: 200 }
				)
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})
async function mount(element: React.ReactNode) {
	await act(async () => root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>))
}
function button(name: string) {
	const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name
	)
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
		mutationFn: () => api.regenerate() as Promise<string>,
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
	api.copy.mockReturnValueOnce(request.promise).mockResolvedValueOnce(undefined)
	await mount(<ApiHarness />)
	await click('Copy')
	await vi.waitFor(() => expect(button('Copying…').disabled).toBe(true))
	expect(container.textContent).not.toContain('Copied')
	await act(async () => request.reject(new Error('Permission denied')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not copy'))
	await click('Copy')
	await vi.waitFor(() => expect(button('Copied')).toBeDefined())
	expect(api.copy).toHaveBeenCalledWith('old-test-key')
	expect(api.error).not.toHaveBeenCalled()
})
test('each successful copy gets a fresh feedback interval, while a later failure stays visible', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
	api.copy.mockResolvedValue(undefined)
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
	expect(api.copy).toHaveBeenCalledTimes(2)
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
	api.copy.mockRejectedValueOnce(new Error('Permission denied'))
	await click('Copied')
	await act(async () => {
		await vi.advanceTimersByTimeAsync(2100)
	})
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not copy')
})
test('regeneration keeps confirmation and old key on failure, retries, and closes on success', async () => {
	const request = Promise.withResolvers<string>()
	api.regenerate.mockReturnValueOnce(request.promise).mockResolvedValueOnce('new-test-key')
	await mount(<ApiHarness />)
	await click('Regenerate')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Cancel')
	expect(api.regenerate).not.toHaveBeenCalled()
	await click('Regenerate')
	const confirm = [...dialog()!.querySelectorAll('button')].find((el) => el.textContent?.trim() === 'Regenerate')!
	await act(async () => confirm.click())
	await vi.waitFor(() => expect(confirm.getAttribute('aria-disabled')).toBe('true'))
	await act(async () => confirm.click())
	expect(api.regenerate).toHaveBeenCalledOnce()
	await act(async () => request.reject(new Error('Generation refused')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Generation refused'))
	await act(async () => confirm.click())
	await vi.waitFor(() => expect(dialog()).toBeUndefined())
	await click('Show API key')
	expect(container.textContent).toContain('new-test-key')
})
test('first key generation needs no destructive confirmation and exposes retry feedback', async () => {
	api.regenerate.mockRejectedValueOnce(new Error('Try again')).mockResolvedValueOnce('first-test-key')
	await mount(<ApiHarness initialKey={null} />)
	await click('Generate API Key')
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Try again'))
	expect(dialog()).toBeUndefined()
	await click('Generate API Key')
	await vi.waitFor(() => expect(button('Show API key')).toBeDefined())
})
async function selectReplacement(sponsorId: string, slug: string) {
	const input = document.querySelector<HTMLInputElement>(`#replacement-${sponsorId}`)!
	await act(async () => {
		input.focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'New')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await vi.waitFor(() => expect(document.querySelector('[role="option"]')).not.toBeNull())
	await act(async () =>
		[...document.querySelectorAll<HTMLElement>('[role="option"]')]
			.find((option) => option.textContent?.includes(`/protocol/${slug}`))!
			.click()
	)
}
test('an old sponsor update cannot close a reopened editor or clear its new selection', async () => {
	const request = Promise.withResolvers<{}>()
	api.update.mockReturnValueOnce(request.promise).mockResolvedValueOnce({})
	await mount(<ResearchSponsorsAdminView />)
	await vi.waitFor(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await click('Save page')
	await click('Cancel edit')
	await click('Change page')
	await selectReplacement('s1', 'second')
	await act(async () => request.resolve({}))
	expect(document.querySelector('#replacement-s1')).not.toBeNull()
	expect(button('Save page').disabled).toBe(false)
	await click('Save page')
	await vi.waitFor(() => expect(document.querySelector('#replacement-s1')).toBeNull())
	expect(api.update).toHaveBeenCalledTimes(2)
	expect(api.update.mock.calls[1][1].entitySlug).toBe('second')
})
test.each(['success', 'failure'] as const)(
	'a reopened sponsor save waits for the previous request to settle with %s',
	async (outcome) => {
		const first = Promise.withResolvers<{}>()
		const second = Promise.withResolvers<{}>()
		api.update.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
		await mount(<ResearchSponsorsAdminView />)
		await vi.waitFor(() => expect(button('Change page')).toBeDefined())
		await click('Change page')
		await selectReplacement('s1', 'new')
		await click('Save page')
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce())
		await click('Cancel edit')
		await click('Change page')
		await selectReplacement('s1', 'second')
		await click('Save page')
		await vi.waitFor(() => expect(button('Saving…').getAttribute('aria-disabled')).toBe('true'))
		expect(api.update).toHaveBeenCalledOnce()
		await act(async () => {
			if (outcome === 'success') first.resolve({})
			else first.reject(new Error('Offline'))
		})
		await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2))
		expect(api.update.mock.calls[1][1].entitySlug).toBe('second')
		expect(document.querySelector('#replacement-s1')).not.toBeNull()
		expect(document.querySelector('[role="alert"]')).toBeNull()
		await act(async () => second.resolve({}))
		await vi.waitFor(() => expect(document.querySelector('#replacement-s1')).toBeNull())
	}
)

test('a pending sponsor save does not block saving another sponsor', async () => {
	const first = Promise.withResolvers<{}>()
	api.update.mockReturnValueOnce(first.promise).mockResolvedValueOnce({})
	api.sponsors.mockResolvedValue([
		{ id: 's1', displayName: 'First', entityType: 'protocol', entitySlug: 'first', reports: [] },
		{ id: 's2', displayName: 'Second', entityType: 'protocol', entitySlug: 'second', reports: [] }
	])
	await mount(<ResearchSponsorsAdminView />)
	await vi.waitFor(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await click('Save page')
	await vi.waitFor(() => expect(api.update).toHaveBeenCalledOnce())
	await click('Change page')
	await selectReplacement('s2', 'second')
	await click('Save page')
	await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2))
	expect(api.update.mock.calls.map(([id]) => id)).toEqual(['s1', 's2'])
	await vi.waitFor(() => expect(document.querySelector('#replacement-s2')).toBeNull())
	expect(document.querySelector('#replacement-s1')).not.toBeNull()
	await act(async () => first.resolve({}))
	await vi.waitFor(() => expect(document.querySelector('#replacement-s1')).toBeNull())
})

test('sponsor save failure preserves the selected page and retries inline', async () => {
	api.update.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({})
	await mount(<ResearchSponsorsAdminView />)
	await vi.waitFor(() => expect(button('Change page')).toBeDefined())
	await click('Change page')
	await selectReplacement('s1', 'new')
	await click('Save page')
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Failed to update'))
	expect(document.querySelector('#replacement-s1')).not.toBeNull()
	expect(api.error).not.toHaveBeenCalled()
	await click('Save page')
	await vi.waitFor(() => expect(document.querySelector('#replacement-s1')).toBeNull())
})
test('sponsor deletion removes the row and restores focus to the surviving heading', async () => {
	api.removeSponsor.mockImplementation(async () => {
		api.sponsors.mockResolvedValue([])
	})
	await mount(<ResearchSponsorsAdminView />)
	await vi.waitFor(() => expect(button('Remove')).toBeDefined())
	await click('Remove')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Cancel')))
	const confirm = [...dialog()!.querySelectorAll('button')].find((el) => el.textContent === 'Remove')!
	await act(async () => confirm.click())
	await vi.waitFor(() => expect(container.textContent).not.toContain('Original sponsor'))
	await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Sponsored reports'))
})
test.each([
	['Delete Example logo', 'logo'],
	['Delete mention example', 'mention']
] as const)('%s sends only the selected deletion', async (name, kind) => {
	const remove = kind === 'logo' ? api.removeLogo : api.removeMention
	remove.mockRejectedValueOnce(new Error('Retry deletion')).mockResolvedValueOnce(undefined)
	await mount(<TrustedByAdminView />)
	await vi.waitFor(() => expect(button(name)).toBeDefined())
	await click(name)
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Delete')
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Retry deletion'))
	await click('Delete')
	await vi.waitFor(() => expect(dialog()).toBeUndefined())
	expect(remove).toHaveBeenCalledTimes(2)
	expect(kind === 'logo' ? api.removeMention : api.removeLogo).not.toHaveBeenCalled()
})

test('deletion stays pending through the list refresh before restoring focus after its row disappears', async () => {
	const refreshed = Promise.withResolvers<Array<never>>()
	api.removeLogo.mockImplementation(async () => {
		api.logos.mockReturnValue(refreshed.promise)
	})
	await mount(<TrustedByAdminView />)
	await vi.waitFor(() => expect(button('Delete Example logo')).toBeDefined())
	await click('Delete Example logo')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Cancel')))
	await click('Delete')
	await vi.waitFor(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await act(async () => refreshed.resolve([]))
	await vi.waitFor(() => expect(dialog()).toBeUndefined())
	await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Trusted By'))
})
