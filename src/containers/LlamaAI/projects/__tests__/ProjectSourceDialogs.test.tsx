// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts, fieldErrorOf } from '~/utils/testing/fieldErrors'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { FileDropProvider } from '../../components/FileDrop'
import { AddSourcesMenu } from '../AddSourcesMenu'
import { AddTextContentModal } from '../AddTextContentModal'
import { GitHubConnectModal } from '../GitHubConnectModal'
import { ProjectFilesPanel } from '../ProjectFilesPanel'

const api = vi.hoisted(() => ({
	installations: vi.fn(),
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
	if (path === '/github/installations')
		return (await api.installations()) ?? [{ installation_id: 1, account_login: 'owner' }]
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
	const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => accessibleName(e) === name)
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
function Harness({ kind, projectId }: { kind: 'github' | 'text'; projectId: string }) {
	const store = Ariakit.useDialogStore()
	return (
		<>
			<Ariakit.DialogDisclosure store={store}>Open sources</Ariakit.DialogDisclosure>
			{kind === 'github' ? (
				<GitHubConnectModal dialogStore={store} projectId={projectId} />
			) : (
				<AddTextContentModal dialogStore={store} projectId={projectId} />
			)}
		</>
	)
}
async function renderHarness(kind: 'github' | 'text', projectId = 'qa') {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness kind={kind} projectId={projectId} />
			</session.Wrapper>
		)
	)
}
async function mount(kind: 'github' | 'text') {
	await renderHarness(kind)
	await click('Open sources')
}
function field(label: string) {
	const el = [...document.querySelectorAll('label')].find((e) => e.textContent === label)!
	return document.getElementById(el.htmlFor) as HTMLInputElement
}
async function selectRepo() {
	await waitForUi(() => expect(document.querySelector('input[role="combobox"]')).not.toBeNull())
	await fill(field('Repository'), 'repo')
	await waitForUi(() => expect(document.querySelector('[role="option"]')).not.toBeNull())
	await act(async () => (document.querySelector('[role="option"]') as HTMLElement).click())
	await waitForUi(() => expect(field('Branch')?.value).toBe('main'))
}

test('GitHub connection locks the dialog until the request settles', async () => {
	const request = Promise.withResolvers<{}>()
	api.connect.mockReturnValueOnce(request.promise)
	await mount('github')
	const dialog = openDialog()!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Connect a GitHub repo')
	await selectRepo()
	expect(field('Repository').value).toBe('owner/repo')
	await click('Connect')
	await waitForUi(() => expect(button('Connecting…').getAttribute('aria-busy')).toBe('true'))
	expect(button('Close dialog').getAttribute('aria-disabled')).toBe('true')
	expect(button('Cancel').getAttribute('aria-disabled')).toBe('true')
	await click('Close dialog')
	expect(openDialog()).toBeDefined()
	await act(async () => request.resolve({}))
	await waitForUi(() => expect(openDialog()).toBeUndefined())
	expect(api.connect.mock.calls).toEqual([['qa', { owner: 'owner', repo: 'repo', branch: 'main', installation_id: 1 }]])
	expect(api.success).not.toHaveBeenCalled()
})

test('a GitHub connection that finishes after its project changes leaves the new dialog alone', async () => {
	const request = Promise.withResolvers<{}>()
	api.connect.mockReturnValueOnce(request.promise)
	await mount('github')
	await selectRepo()
	await click('Connect')
	await waitForUi(() => expect(button('Connecting…')).toBeDefined())
	await renderHarness('github', 'other')
	await waitForUi(() => expect(button('Connect').getAttribute('aria-busy')).toBeNull())
	await act(async () => request.resolve({}))
	await waitForUi(() => expect(api.success).toHaveBeenCalledExactlyOnceWith('Connected owner/repo'))
	expect(openDialog()).toBeDefined()
	expect(field('Repository').value).toBe('')
})

test('a retried installation list keeps its error while retrying, then the picker takes focus', async () => {
	const retry = Promise.withResolvers<Array<{ installation_id: number; account_login: string }>>()
	api.installations.mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(retry.promise)
	await mount('github')
	await waitForUi(() => expect(button('Try again')).toBeDefined())
	const tryAgain = button('Try again')
	await act(async () => {
		tryAgain.focus()
		tryAgain.click()
	})
	await waitForUi(() => expect(accessibleName(tryAgain)).toBe('Retrying…'))
	await act(async () => retry.resolve([{ installation_id: 1, account_login: 'owner' }]))
	await waitForUi(() => expect(document.activeElement).toBe(field('Installation')))
})

test('Connect with nothing chosen names the missing field', async () => {
	await mount('github')
	await waitForUi(() => expect(document.querySelector('input[role="combobox"]')).not.toBeNull())
	await click('Connect')
	expect(fieldErrorOf(field('Repository'))).toBeTruthy()
	expect(document.activeElement).toBe(field('Repository'))
	expect(api.connect).not.toHaveBeenCalled()
	await selectRepo()
	expect(fieldErrorOf(field('Repository'))).toBeNull()
})

test('GitHub failure stays inline, keeps selection, and can retry', async () => {
	api.connect.mockRejectedValueOnce(new Error('Connection refused')).mockResolvedValueOnce({})
	await mount('github')
	await selectRepo()
	await click('Connect')
	await waitForUi(() => expect(alertTexts(openDialog()!)).toHaveLength(1))
	expect(field('Repository').value).toBe('owner/repo')
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

test('closing typed text asks first, and keeping it returns to the draft', async () => {
	await mount('text')
	await fill(document.querySelector('textarea')!, 'Article notes')
	await click('Cancel')
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard this text?')
	await click('Keep editing')
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	expect(document.querySelector('textarea')?.value).toBe('Article notes')
})

test('text import locks the dialog while it saves and names an empty field', async () => {
	const request = Promise.withResolvers<{ imported: Array<{ path: string }>; skipped: [] }>()
	api.add.mockReturnValue(request.promise)
	await mount('text')
	await fill(document.querySelector('input')!, 'notes.md')
	await click('Save')
	expect(fieldErrorOf(document.querySelector('textarea')!)).toBeTruthy()
	expect(document.activeElement).toBe(document.querySelector('textarea'))
	expect(api.add).not.toHaveBeenCalled()
	await fill(document.querySelector('textarea')!, 'Note')
	expect(fieldErrorOf(document.querySelector('textarea')!)).toBeNull()
	await click('Save')
	await waitForUi(() => expect(button('Saving…').getAttribute('aria-busy')).toBe('true'))
	expect(button('Cancel').getAttribute('aria-disabled')).toBe('true')
	await click('Cancel')
	expect(openDialog()).toBeDefined()
	await act(async () => request.resolve({ imported: [{ path: 'notes.md' }], skipped: [] }))
	await waitForUi(() => expect(openDialog()).toBeUndefined())
	expect(api.success).not.toHaveBeenCalled()
})

test('a failed text import stays inline as a plain sentence, also while its retry saves', async () => {
	const retry = Promise.withResolvers<{ imported: Array<{ path: string }>; skipped: [] }>()
	api.add.mockRejectedValueOnce(new Error('Failed to fetch')).mockReturnValueOnce(retry.promise)
	await mount('text')
	await fill(document.querySelector('input')!, 'notes.md')
	await fill(document.querySelector('textarea')!, 'Note')
	await click('Save')
	// The site's own sentence, never the fetch error's message.
	await waitForUi(() => expect(alertTexts(openDialog()!)).toHaveLength(1))
	expect(alertTexts(openDialog()!)[0]).not.toContain('Failed to fetch')
	expect(api.error).not.toHaveBeenCalled()
	await click('Save')
	await waitForUi(() => expect(button('Saving…')).toBeDefined())
	expect(alertTexts(openDialog()!)).toHaveLength(1)
	await act(async () => retry.resolve({ imported: [{ path: 'notes.md' }], skipped: [] }))
	await waitForUi(() => expect(openDialog()).toBeUndefined())
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
	expect(button('Cancel').getAttribute('aria-disabled')).toBe('true')
	await act(async () => request.reject(new Error('Please retry')))
	await waitForUi(() => expect(alertTexts(openDialog()!)).toHaveLength(1))
	expect(alertTexts(openDialog()!)[0]).not.toContain('Please retry')
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
	expect(container.querySelector<HTMLButtonElement>('button[aria-hidden="true"]')?.getAttribute('aria-disabled')).toBe(
		'true'
	)
	await act(async () => request.reject(new Error('Offline')))
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
	expect(container.querySelector<HTMLButtonElement>('button[aria-hidden="true"]')?.getAttribute('aria-disabled')).toBe(
		'true'
	)
	await click('Try again')
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
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
	await waitForUi(() => expect(container.textContent).toContain('notes.md'))
	expect(container.querySelector('[aria-label="Delete notes.md"]')).toBeNull()
	await click('Try again')
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
	await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
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
	// The target started the upload, so it keeps focus while it waits.
	expect(target.getAttribute('aria-disabled')).toBe('true')
	expect(target.disabled).toBe(false)
	await drop()
	expect(api.upload).toHaveBeenCalledOnce()
	await act(async () => request.resolve({ imported: [], skipped: [] }))
	await waitForUi(() => expect(target.hasAttribute('aria-disabled')).toBe(false))
	expect(button('Add project source').disabled).toBe(false)
})

test('GitHub files never get a per-file delete action while source metadata loads', async () => {
	const request = Promise.withResolvers<Array<{ id: string; adapter_type: string; config: object }>>()
	api.sources.mockReturnValue(request.promise)
	api.files.mockResolvedValue({ files: [{ id: 'file-1', source_id: 'github-1', path: 'repo/notes.md', size: 100 }] })
	await mountFiles()
	await waitForUi(() => expect(container.textContent).toContain('repo/notes.md'))
	expect(Array.from(container.querySelectorAll('[role="status"]'), (status) => status.textContent)).toContain(
		'Loading connected sources'
	)
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
	expect(drop.getAttribute('aria-disabled')).toBe('true')
	expect(drop.getAttribute('aria-hidden')).toBe('true')
	expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
	expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading files')
	await act(async () => files.resolve({ files: [] }))
	await waitForUi(() => expect(container.textContent).toContain('Loading connected sources'))
	expect(drop.getAttribute('aria-hidden')).toBe('true')
	await act(async () => sources.resolve([]))
	await waitForUi(() => expect(drop.hasAttribute('aria-disabled')).toBe(false))
	expect(drop.hasAttribute('aria-hidden')).toBe(false)
	expect(container.querySelector('[role="status"]')).toBeNull()
})

test('discarding text opened from the sources menu returns focus to the menu button', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<FileDropProvider>
					<AddSourcesMenu projectId="qa" trigger={<button type="button">Add files</button>} />
				</FileDropProvider>
			</session.Wrapper>
		)
	)
	await click('Add files')
	await waitForUi(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
	const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((e) =>
		e.textContent?.includes('Add text content')
	)!
	await act(async () => item.click())
	await waitForUi(() => expect(document.querySelector('[role="dialog"] textarea')).not.toBeNull())
	await fill(document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!, 'Article notes')
	await click('Cancel')
	await click('Discard')
	await waitForUi(() => expect(openDialog()).toBeUndefined())
	await waitForUi(() => expect(document.activeElement).toBe(button('Add files')))
})
