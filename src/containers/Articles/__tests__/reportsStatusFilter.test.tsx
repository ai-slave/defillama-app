// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ReportsAdminView } from '../admin/ReportsAdminView'
import { createEmptyLocalArticle } from '../document'

const session = installSubscriberSession('editor-1')

const report = (id: string, title: string, status: 'draft' | 'published') => ({
	...createEmptyLocalArticle('2026-09-01T00:00:00.000Z'),
	id,
	title,
	slug: id,
	section: 'report',
	status
})

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.serve({
		[`${FEATURES_SERVER}/articles`]: {
			items: [report('live', 'Live report', 'published'), report('draft', 'Draft report', 'draft')],
			totalItems: 2,
			totalPages: 1
		}
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

// Each report row leads with its title, linked to the editor.
const titles = () => [...container.querySelectorAll('ul > li')].map((row) => row.querySelector('a')!.textContent)
const radio = (name: string) =>
	[
		...container.querySelectorAll<HTMLInputElement>('[role="radiogroup"][aria-label="Status"] input[type="radio"]')
	].find((input) => input.closest('label')!.textContent === name)!

test('the status filter is one radio pick that narrows the reports list', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ReportsAdminView />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(titles()).toEqual(['Live report', 'Draft report']))
	expect(radio('All').checked).toBe(true)

	await act(async () => radio('Drafts').click())
	expect(radio('Drafts').checked).toBe(true)
	expect(radio('All').checked).toBe(false)
	expect(titles()).toEqual(['Draft report'])
})
