// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { FileDropProvider } from '../../components/FileDrop'
import { AddTextContentModal } from '../AddTextContentModal'
import { GitHubConnectModal } from '../GitHubConnectModal'
import { ProjectFilesPanel } from '../ProjectFilesPanel'

const api = vi.hoisted(() => ({
	connect: vi.fn(),
	add: vi.fn(),
	remove: vi.fn(),
	files: vi.fn(),
	sources: vi.fn(),
	upload: vi.fn(),
	success: vi.fn(),
	error: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: {}, replace: vi.fn() }) }))
vi.mock('react-hot-toast', () => ({ default: { success: api.success, error: api.error } }))

// The AI server: each endpoint answers through the matching `api` function.
async function aiServer(url: URL, init?: RequestInit) {
	const path = url.href.slice(AI_SERVER.length)
	const json = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
	const method = init?.method ?? 'GET'
	if (path === '/github/installations') return [{ installation_id: 1, account_login: 'owner' }]
	if (path === '/github/installations/1/repos')
		return { repos: [{ full_name: 'owner/repo', name: 'repo', private: false }] }
	if (path === '/github/installations/1/repos/owner/repo/branches') return [{ name: 'main', is_default: true }]
	if (path === '/projects/qa/sources/github' && method === 'POST') return { source: await api.connect('qa', json) }
	if (path === '/projects/qa/files/text' && method === 'POST') return api.add('qa', json.name, json.content)
	if (path === '/projects/qa/files' && method === 'POST') return api.upload('qa', init!.body)
	if (path.startsWith('/projects/qa/files/') && method === 'DELETE')
		return (await api.remove('qa', path.slice(19))) ?? {}
	if (path === '/projects/qa/files?limit=500') return api.files('qa')
	if (path === '/projects/qa/sources') return { sources: await api.sources('qa') }
	throw new Error(`Unexpected AI request: ${method} ${path}`)
}
const session = installSubscriberSession('user')
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.resetAllMocks()
	api.sources.mockResolvedValue([{ id: 'blob', adapter_type: 'blob' }])
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({ [AI_SERVER]: aiServer })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
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
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
	await click('Open sources')
}
async function selectRepo() {
	await waitForUi(() => expect(document.querySelector('input[role="combobox"]')).not.toBeNull())
	const label = [...document.querySelectorAll('label')].find((e) => e.textContent === 'Repository')!
	await fill(document.getElementById(label.htmlFor) as HTMLInputElement, 'repo')
	await waitForUi(() => expect(document.querySelector('[role="option"]')).not.toBeNull())
	await act(async () => (document.querySelector('[role="option"]') as HTMLElement).click())
	await waitForUi(() => expect(button('Connect').disabled).toBe(false))
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
	await waitForUi(() => expect(openDialog()).toBeUndefined())
	expect(api.connect).toHaveBeenCalledTimes(2)
	expect(api.connect.mock.calls[0]).toEqual([
		'qa',
		{ owner: 'owner', repo: 'repo', branch: 'main', installation_id: 1 }
	])
})

test('GitHub failure stays inline, keeps selection, and can retry', async () => {
	api.connect.mockRejectedValueOnce(new Error('Connection refused')).mockResolvedValueOnce({})
	await mount('github')
	await selectRepo()
	await click('Connect')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Connection refused'))
	expect(api.error).not.toHaveBeenCalled()
	await click('Connect')
	await waitForUi(() => expect(openDialog()).toBeUndefined())
	expect(api.connect).toHaveBeenCalledTimes(2)
})

test('text import focuses its filename, keeps a skipped draft, and resets after success', async () => {
	api.add
		.mockResolvedValueOnce({ imported: [], skipped: [{ path: 'notes.md', reason: 'File limit reached' }] })
		.mockResolvedValueOnce({ imported: [{ path: 'notes.md' }], skipped: [] })
	await mount('text')
	const input = document.querySelector('input')!
	await waitForUi(() => expect(document.activeElement).toBe(input))
	await fill(input, 'notes.md')
	await fill(document.querySelector('textarea')!, 'Article notes')
	await click('Save')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('File limit reached'))
	expect(document.querySelector('textarea')?.value).toBe('Article notes')
	await click('Save')
	await waitForUi(() => expect(openDialog()).toBeUndefined())
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
			<session.Wrapper>
				<ProjectFilesPanel
					projectId="qa"
					projectBytesUsed={100}
					projectBytesLimit={1000}
					projectFileCount={1}
					projectFileLimit={10}
					tier="paid"
				/>
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(button('Delete notes.md')).toBeDefined())
	const trigger = button('Delete notes.md')
	await click('Delete notes.md')
	await click('Cancel')
	await waitForUi(() => expect(document.activeElement).toBe(trigger))
	await click('Delete notes.md')
	await click('Delete')
	await waitForUi(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
	await click('Deleting…')
	expect(api.remove).toHaveBeenCalledTimes(1)
	expect(button('Cancel').disabled).toBe(true)
	await act(async () => request.reject(new Error('Please retry')))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Please retry'))
	expect(openDialog()).toBeDefined()
	await click('Delete')
	await waitForUi(() => expect(openDialog()).toBeUndefined())
	await waitForUi(() => expect(document.activeElement).toBe(button('Add project source')))
	expect(document.body.textContent).not.toContain('notes.md')
})

async function mountFiles() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<FileDropProvider>
					<ProjectFilesPanel
						projectId="qa"
						projectBytesUsed={0}
						projectBytesLimit={1000}
						projectFileCount={0}
						projectFileLimit={10}
						tier="paid"
					/>
				</FileDropProvider>
			</session.Wrapper>
		)
	)
}

test('file loading and failure do not look empty, retry restores the upload target', async () => {
	const request = Promise.withResolvers<{ files: [] }>()
	api.files.mockReturnValueOnce(request.promise).mockResolvedValueOnce({ files: [] })
	await mountFiles()
	expect(container.textContent).toContain('Loading files')
	expect(container.querySelector<HTMLButtonElement>('button[aria-hidden="true"]')?.disabled).toBe(true)
	await act(async () => request.reject(new Error('Offline')))
	await waitForUi(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load files.")
	)
	expect(container.querySelector<HTMLButtonElement>('button[aria-hidden="true"]')?.disabled).toBe(true)
	await click('Retry files')
	await waitForUi(() => expect(container.querySelector('[role="alert"]')).toBeNull())
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(api.files).toHaveBeenCalledTimes(2)
	const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
	const pick = vi.spyOn(input, 'click').mockImplementation(() => {})
	const target = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Drop files here'))!
	await act(async () => target.click())
	expect(pick).toHaveBeenCalledOnce()
})

test('connected source failure has its own retry without hiding available files', async () => {
	api.sources.mockRejectedValueOnce(new Error('Sources offline')).mockResolvedValueOnce([])
	api.files.mockResolvedValue({ files: [{ id: 'file-1', source_id: 'blob', path: 'notes.md', size: 100 }] })
	await mountFiles()
	await waitForUi(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load connected sources.")
	)
	await waitForUi(() => expect(container.textContent).toContain('notes.md'))
	expect(container.querySelector('[aria-label="Delete notes.md"]')).toBeNull()
	await click('Retry sources')
	await waitForUi(() => expect(container.querySelector('[role="alert"]')).toBeNull())
	expect(container.textContent).toContain('notes.md')
	expect(api.sources).toHaveBeenCalledTimes(2)
})

test('a background file refresh failure preserves the known files and offers retry', async () => {
	api.files
		.mockResolvedValueOnce({ files: [{ id: 'file-1', source_id: 'blob', path: 'notes.md', size: 100 }] })
		.mockRejectedValueOnce(new Error('Offline'))
	await mountFiles()
	await waitForUi(() => expect(container.textContent).toContain('notes.md'))
	await act(async () => {
		await session.client.refetchQueries()
	})
	await waitForUi(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load files.")
	)
	expect(container.textContent).toContain('notes.md')
	expect(container.textContent).not.toContain('Drop files here')
})

test('upload pending disables picking and ignores another drop until completion', async () => {
	const request = Promise.withResolvers<{ imported: []; skipped: [] }>()
	api.files.mockResolvedValue({ files: [] })
	api.upload.mockReturnValueOnce(request.promise)
	await mountFiles()
	await waitForUi(() => expect(container.textContent).toContain('Drop files here'))
	const target = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Drop files here'))!
	const file = new File(['Test source'], 'notes.md', { type: 'text/markdown' })
	async function drop() {
		await act(async () =>
			target.dispatchEvent(
				Object.assign(new Event('drop', { bubbles: true, cancelable: true }), {
					dataTransfer: { files: [file], types: ['Files'] }
				})
			)
		)
	}
	await drop()
	await waitForUi(() => expect(container.textContent).toContain('Uploading…'))
	expect(button('Add project source').disabled).toBe(true)
	expect(target.disabled).toBe(true)
	await drop()
	expect(api.upload).toHaveBeenCalledOnce()
	await act(async () => request.resolve({ imported: [], skipped: [] }))
	await waitForUi(() => expect(target.disabled).toBe(false))
	expect(button('Add project source').disabled).toBe(false)
})

test('GitHub files never get a per-file delete action while source metadata loads', async () => {
	const request = Promise.withResolvers<Array<{ id: string; adapter_type: string; config: object }>>()
	api.sources.mockReturnValue(request.promise)
	api.files.mockResolvedValue({ files: [{ id: 'file-1', source_id: 'github-1', path: 'repo/notes.md', size: 100 }] })
	await mountFiles()
	await waitForUi(() => expect(container.textContent).toContain('repo/notes.md'))
	expect(container.querySelector('[role="status"][aria-label="Loading connected sources"]')).not.toBeNull()
	expect(container.querySelector('[aria-label="Delete repo/notes.md"]')).toBeNull()
	await act(async () =>
		request.resolve([{ id: 'github-1', adapter_type: 'github', config: { owner: 'owner', repo: 'repo' } }])
	)
	await waitForUi(() => expect(container.textContent).toContain('GitHub'))
	expect(container.querySelector('[aria-label="Delete repo/notes.md"]')).toBeNull()
})

test('file picking stays unavailable until both file and source requests settle', async () => {
	const files = Promise.withResolvers<{ files: [] }>()
	const sources = Promise.withResolvers<[]>()
	api.files.mockReturnValue(files.promise)
	api.sources.mockReturnValue(sources.promise)
	await mountFiles()
	const drop = [...container.querySelectorAll<HTMLButtonElement>('button')].find((node) =>
		node.textContent?.includes('Drop files here')
	)!
	expect(drop.disabled).toBe(true)
	expect(drop.getAttribute('aria-hidden')).toBe('true')
	expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
	expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading files')
	await act(async () => files.resolve({ files: [] }))
	await waitForUi(() => expect(container.textContent).toContain('Loading connected sources'))
	expect(drop.getAttribute('aria-hidden')).toBe('true')
	await act(async () => sources.resolve([]))
	await waitForUi(() => expect(drop.disabled).toBe(false))
	expect(drop.hasAttribute('aria-hidden')).toBe(false)
	expect(container.querySelector('[role="status"]')).toBeNull()
})
