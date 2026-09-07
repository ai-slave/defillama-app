// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AddTextContentModal } from './AddTextContentModal'
import { GitHubConnectModal } from './GitHubConnectModal'
import { ProjectFilesPanel } from './ProjectFilesPanel'

const api = vi.hoisted(() => ({
	connect: vi.fn(),
	add: vi.fn(),
	remove: vi.fn(),
	files: vi.fn(),
	success: vi.fn(),
	error: vi.fn()
}))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ isAuthenticated: true, authorizedFetch: vi.fn() }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: {}, replace: vi.fn() }) }))
vi.mock('react-hot-toast', () => ({ default: { success: api.success, error: api.error } }))
vi.mock('./api', async (original) => ({
	...(await original<typeof import('./api')>()),
	listGithubInstallations: async () => [{ installation_id: 1, account_login: 'owner' }],
	listInstallationRepos: async () => [{ full_name: 'owner/repo', name: 'repo', private: false }],
	listInstallationRepoBranches: async () => [{ name: 'main', is_default: true }],
	connectGithubSource: api.connect,
	addTextFile: api.add,
	deleteProjectFile: api.remove,
	listProjectFiles: api.files,
	listProjectSources: async () => []
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
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
function button(name: string) {
	const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(e) => e.getAttribute('aria-label') === name || e.textContent?.trim() === name
	)
	expect(el).toBeDefined()
	return el!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
	await act(async () => {
		input.focus()
		Object.getOwnPropertyDescriptor(
			input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
			'value'
		)!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
function openDialog() {
	return [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')].find((e) => !e.hidden)
}
async function mount(kind: 'github' | 'text') {
	function Harness() {
		const store = Ariakit.useDialogStore()
		return (
			<>
				<Ariakit.DialogDisclosure store={store}>Open sources</Ariakit.DialogDisclosure>
				{kind === 'github' ? (
					<GitHubConnectModal dialogStore={store} projectId="qa" />
				) : (
					<AddTextContentModal dialogStore={store} projectId="qa" />
				)}
			</>
		)
	}
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
	await click('Open sources')
}
async function selectRepo() {
	await vi.waitFor(() => expect(document.querySelector('input[role="combobox"]')).not.toBeNull())
	const label = [...document.querySelectorAll('label')].find((e) => e.textContent === 'Repository')!
	await fill(document.getElementById(label.htmlFor) as HTMLInputElement, 'repo')
	await vi.waitFor(() => expect(document.querySelector('[role="option"]')).not.toBeNull())
	await act(async () => (document.querySelector('[role="option"]') as HTMLElement).click())
	await vi.waitFor(() => expect(button('Connect').disabled).toBe(false))
}

test('GitHub connection preserves the new dialog when an older request completes', async () => {
	const request = Promise.withResolvers<{}>()
	api.connect.mockReturnValueOnce(request.promise).mockResolvedValueOnce({})
	await mount('github')
	const dialog = openDialog()!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Connect a GitHub repo')
	await selectRepo()
	await click('Connect')
	await click('Close GitHub connection dialog')
	await click('Open sources')
	await selectRepo()
	await act(async () => request.resolve({}))
	expect(openDialog()).toBeDefined()
	expect(button('Connect').disabled).toBe(false)
	await click('Connect')
	await vi.waitFor(() => expect(openDialog()).toBeUndefined())
	expect(api.connect).toHaveBeenCalledTimes(2)
	expect(api.connect.mock.calls[0].slice(1)).toEqual([
		'qa',
		{ owner: 'owner', repo: 'repo', branch: 'main', installation_id: 1 }
	])
})

test('GitHub failure stays inline, keeps selection, and can retry', async () => {
	api.connect.mockRejectedValueOnce(new Error('Connection refused')).mockResolvedValueOnce({})
	await mount('github')
	await selectRepo()
	await click('Connect')
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Connection refused'))
	expect(api.error).not.toHaveBeenCalled()
	await click('Connect')
	await vi.waitFor(() => expect(openDialog()).toBeUndefined())
	expect(api.connect).toHaveBeenCalledTimes(2)
})

test('text import focuses its filename, keeps a skipped draft, and resets after success', async () => {
	api.add
		.mockResolvedValueOnce({ imported: [], skipped: [{ path: 'notes.md', reason: 'File limit reached' }] })
		.mockResolvedValueOnce({ imported: [{ path: 'notes.md' }], skipped: [] })
	await mount('text')
	const input = document.querySelector('input')!
	await vi.waitFor(() => expect(document.activeElement).toBe(input))
	await fill(input, 'notes.md')
	await fill(document.querySelector('textarea')!, 'Article notes')
	await click('Save')
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('File limit reached'))
	expect(document.querySelector('textarea')?.value).toBe('Article notes')
	await click('Save')
	await vi.waitFor(() => expect(openDialog()).toBeUndefined())
	await click('Open sources')
	expect(document.querySelector('input')?.value).toBe('')
	expect(document.querySelector('textarea')?.value).toBe('')
})

test('text completion cannot discard a reopened draft', async () => {
	const request = Promise.withResolvers<{ imported: Array<{ path: string }>; skipped: [] }>()
	api.add.mockReturnValue(request.promise)
	await mount('text')
	await fill(document.querySelector('input')!, 'old.md')
	await fill(document.querySelector('textarea')!, 'Old note')
	await click('Save')
	await click('Cancel')
	await click('Open sources')
	await fill(document.querySelector('input')!, 'new.md')
	await fill(document.querySelector('textarea')!, 'New note')
	await act(async () => request.resolve({ imported: [{ path: 'old.md' }], skipped: [] }))
	expect(openDialog()).toBeDefined()
	expect(document.querySelector('textarea')?.value).toBe('New note')
})

test('file removal prevents duplicates, retries inline, and focuses Add after removing its trigger', async () => {
	const request = Promise.withResolvers<void>()
	api.files.mockResolvedValue({ files: [{ id: 'file-1', source_id: 'blob', path: 'notes.md', size: 100 }] })
	api.remove.mockReturnValueOnce(request.promise).mockImplementationOnce(async () => {
		api.files.mockResolvedValue({ files: [] })
	})
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ProjectFilesPanel
					projectId="qa"
					projectBytesUsed={100}
					projectBytesLimit={1000}
					projectFileCount={1}
					projectFileLimit={10}
					tier="paid"
				/>
			</QueryClientProvider>
		)
	)
	await vi.waitFor(() => expect(button('Delete notes.md')).toBeDefined())
	const trigger = button('Delete notes.md')
	await click('Delete notes.md')
	await click('Cancel')
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	await click('Delete notes.md')
	await click('Delete')
	await vi.waitFor(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await click('Deleting…')
	expect(api.remove).toHaveBeenCalledTimes(1)
	expect(button('Cancel').disabled).toBe(true)
	await act(async () => request.reject(new Error('Please retry')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Please retry'))
	expect(openDialog()).toBeDefined()
	await click('Delete')
	await vi.waitFor(() => expect(openDialog()).toBeUndefined())
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Add project source')))
	expect(document.body.textContent).not.toContain('notes.md')
})
