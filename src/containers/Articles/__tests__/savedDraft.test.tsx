// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mergeSavedDraft, SavedChangedNotice, sameValue, useSavedDraft } from '../admin/savedDraft'

type Logo = { id: string; name: string; linkUrl: string; tags: Array<string> }
type Form = { name: string; linkUrl: string; tags: Array<string> }

const toForm = (logo: Logo | null): Form =>
	logo ? { name: logo.name, linkUrl: logo.linkUrl, tags: logo.tags } : { name: '', linkUrl: '', tags: [] }

const saved = (over: Partial<Logo> = {}): Logo => ({
	id: 'logo-1',
	name: 'Acme',
	linkUrl: 'https://acme.test',
	tags: ['a'],
	...over
})

describe('mergeSavedDraft', () => {
	test('adopts saved changes to untouched fields and keeps edited fields', () => {
		const previous = toForm(saved())
		const draft = { ...previous, name: 'Acme Corp' }
		const next = toForm(saved({ linkUrl: 'https://acme.example', tags: ['a', 'b'] }))
		const result = mergeSavedDraft(draft, previous, next, sameValue)
		expect(result.draft).toEqual({ name: 'Acme Corp', linkUrl: 'https://acme.example', tags: ['a', 'b'] })
		expect(result.conflicts).toEqual([])
	})

	test('reports an edited field that also changed on the server', () => {
		const previous = toForm(saved())
		const draft = { ...previous, name: 'Acme Corp' }
		const next = toForm(saved({ name: 'ACME Inc' }))
		const result = mergeSavedDraft(draft, previous, next, sameValue)
		expect(result.draft.name).toBe('Acme Corp')
		expect(result.conflicts).toEqual(['name'])
	})

	test('an edit that matches what was saved elsewhere is not a conflict', () => {
		const previous = toForm(saved())
		const draft = { ...previous, name: 'ACME Inc' }
		const next = toForm(saved({ name: 'ACME Inc' }))
		expect(mergeSavedDraft(draft, previous, next, sameValue)).toEqual({ draft, conflicts: [] })
	})

	test('an untouched image adopts the complete saved object when only its metadata changed', () => {
		type Row = { image: { url: string; width?: number; alt?: string } | null; description: string }
		const previous: Row = { image: { url: '/img.png', width: 100 }, description: 'Report' }
		const draft: Row = { ...previous, description: 'Report, revised' }
		const next: Row = { image: { url: '/img.png', width: 640, alt: 'Cover' }, description: 'Report' }
		const result = mergeSavedDraft(draft, previous, next, sameValue)
		expect(result.draft).toEqual({
			image: { url: '/img.png', width: 640, alt: 'Cover' },
			description: 'Report, revised'
		})
		expect(result.conflicts).toEqual([])
	})
})

describe('useSavedDraft', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: ReturnType<typeof useSavedDraft<Logo | null, Form>>

	function Harness({ logo }: { logo: Logo | null }) {
		latest = useSavedDraft(logo, logo?.id ?? null, toForm, sameValue)
		return (
			<input
				value={latest.draft.name}
				onChange={(event) => latest.setDraft((prev) => ({ ...prev, name: event.target.value }))}
			/>
		)
	}

	function render(logo: Logo | null) {
		return act(async () => root.render(<Harness logo={logo} />))
	}

	function type(value: string) {
		const input = container.querySelector('input')!
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
		return act(async () => {
			setValue.call(input, value)
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('unsaved edits survive a refetched copy of the same entity', async () => {
		await render(saved())
		await type('Acme Corp')
		expect(latest.dirty).toBe(true)

		await render(saved())
		expect(container.querySelector('input')!.value).toBe('Acme Corp')
		expect(latest.dirty).toBe(true)
		expect(latest.conflict).toBe(false)
	})

	test('a different entity replaces the draft', async () => {
		await render(saved())
		await type('Acme Corp')

		await render(saved({ id: 'logo-2', name: 'Globex' }))
		expect(container.querySelector('input')!.value).toBe('Globex')
		expect(latest.dirty).toBe(false)
	})

	test('a clean draft adopts what was saved elsewhere', async () => {
		await render(saved())
		await render(saved({ name: 'ACME Inc' }))
		expect(container.querySelector('input')!.value).toBe('ACME Inc')
		expect(latest.dirty).toBe(false)
	})

	test('a conflicting save keeps the edit, flags it, and loadSaved resolves it', async () => {
		await render(saved())
		await type('Acme Corp')
		await render(saved({ name: 'ACME Inc', linkUrl: 'https://acme.example' }))

		expect(container.querySelector('input')!.value).toBe('Acme Corp')
		expect(latest.draft.linkUrl).toBe('https://acme.example')
		expect(latest.conflict).toBe(true)

		await act(async () => latest.loadSaved())
		expect(container.querySelector('input')!.value).toBe('ACME Inc')
		expect(latest.conflict).toBe(false)
		expect(latest.dirty).toBe(false)
	})

	test('the conflict clears once the draft matches the saved value, including after a save lands', async () => {
		await render(saved())
		await type('Acme Corp')
		await render(saved({ name: 'ACME Inc' }))
		expect(latest.conflict).toBe(true)

		// The user saves their edit; the refetch returns it.
		await render(saved({ name: 'Acme Corp' }))
		expect(latest.conflict).toBe(false)
		expect(latest.dirty).toBe(false)

		// A later edit is an ordinary edit, not a stale conflict.
		await type('Acme Corp 2')
		expect(latest.conflict).toBe(false)
		expect(latest.dirty).toBe(true)
	})

	test('a successful save adopts the stored, normalized values and ends clean', async () => {
		await render(saved())
		await type(' Updated banner ')
		const submitted = latest.draft
		await act(async () => latest.acceptSaved(toForm(saved({ name: 'Updated banner' })), submitted))
		expect(container.querySelector('input')!.value).toBe('Updated banner')
		expect(latest.dirty).toBe(false)

		// The refetch returns the same stored values: nothing to adopt, nothing to flag.
		await render(saved({ name: 'Updated banner' }))
		expect(latest.dirty).toBe(false)
		expect(latest.conflict).toBe(false)
	})

	test('an edit typed while the save was in flight survives the save and its refetch', async () => {
		await render(saved())
		await type(' Updated banner ')
		const submitted = latest.draft
		await type('Updated banner, again')
		await act(async () => latest.acceptSaved(toForm(saved({ name: 'Updated banner' })), submitted))
		expect(container.querySelector('input')!.value).toBe('Updated banner, again')
		expect(latest.dirty).toBe(true)

		await render(saved({ name: 'Updated banner' }))
		expect(container.querySelector('input')!.value).toBe('Updated banner, again')
		expect(latest.conflict).toBe(false)
	})

	test('switching from new to the created entity resets to the saved values', async () => {
		await render(null)
		await type('Fresh')
		await render(saved({ name: 'Fresh' }))
		expect(latest.dirty).toBe(false)
		expect(container.querySelector('input')!.value).toBe('Fresh')
	})
})

test('Load saved version hands focus to the first field once the notice leaves', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	function Form() {
		const [conflict, setConflict] = useState(true)
		return (
			<form>
				<input aria-label="Name" />
				<footer>{conflict ? <SavedChangedNotice noun="logo" onLoadSaved={() => setConflict(false)} /> : null}</footer>
			</form>
		)
	}
	await act(async () => root.render(<Form />))
	const load = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Load saved version')!

	await act(async () => {
		load.focus()
		load.click()
	})

	expect(container.textContent).not.toContain('changed elsewhere')
	expect(document.activeElement).toBe(container.querySelector('input'))
	await act(async () => root.unmount())
	container.remove()
})
