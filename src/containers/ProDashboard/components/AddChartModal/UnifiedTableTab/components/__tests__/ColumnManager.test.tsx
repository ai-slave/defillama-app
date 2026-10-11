// @vitest-environment happy-dom
import type { SortingState } from '@tanstack/react-table'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { CustomColumnDefinition } from '~/containers/ProDashboard/unifiedTable/config/types'
import { fieldErrorOf, fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { installSubscriberSession, type SessionAccount } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { type CustomColumnDraft, EMPTY_CUSTOM_COLUMN_DRAFT } from '../../hooks/useUnifiedTableWizard'
import { ColumnManager } from '../ColumnManager'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))

let session: ReturnType<typeof installSubscriberSession>
function signInAs(account: SessionAccount) {
	const installed = installSubscriberSession('u1', { account, resolved: true })
	beforeEach(() => {
		session = installed
		session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	})
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

const renderManager = ({
	sorting = [],
	onSortingChange = vi.fn(),
	customColumnDraft = EMPTY_CUSTOM_COLUMN_DRAFT,
	onCustomColumnDraftChange = vi.fn(),
	customColumns = [],
	onAddCustomColumn = vi.fn()
}: {
	sorting?: SortingState
	onSortingChange?: (sorting: SortingState) => void
	customColumnDraft?: CustomColumnDraft
	onCustomColumnDraftChange?: (draft: CustomColumnDraft) => void
	customColumns?: Array<CustomColumnDefinition>
	onAddCustomColumn?: (column: CustomColumnDefinition) => void
} = {}) =>
	act(async () =>
		root.render(
			<session.Wrapper>
				{/* The Add card dialog's form holds the table editor. */}
				<form noValidate>
					<ColumnManager
						rowHeaders={['protocol']}
						columnOrder={['name', 'tvl']}
						columnVisibility={{}}
						onChange={vi.fn()}
						customColumns={customColumns}
						onAddCustomColumn={onAddCustomColumn}
						onUpdateCustomColumn={vi.fn()}
						onRemoveCustomColumn={vi.fn()}
						customColumnDraft={customColumnDraft}
						onCustomColumnDraftChange={onCustomColumnDraftChange}
						sorting={sorting}
						onSortingChange={onSortingChange}
						onSortingReset={vi.fn()}
					/>
				</form>
			</session.Wrapper>
		)
	)

const radioGroup = (name: string) =>
	Array.from(container.querySelectorAll('[role="radiogroup"]')).find(
		(group) =>
			group.getAttribute('aria-label') === name ||
			document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() === name
	)!
const radio = (group: string, text: string) =>
	Array.from(radioGroup(group).querySelectorAll('label'))
		.find((label) => label.textContent === text)!
		.querySelector<HTMLInputElement>('input[type="radio"]')!
const button = (text: string) =>
	Array.from(container.querySelectorAll('button')).find((element) => element.textContent?.trim() === text)!
const nameField = () => container.querySelector('input[placeholder="e.g., TVL to market cap"]')

describe('without Pro', () => {
	signInAs('free')

	test('a custom column preset offers the upgrade instead of opening the form', async () => {
		const onCustomColumnDraftChange = vi.fn()
		await renderManager({ onCustomColumnDraftChange })
		await act(async () => button('TVL/MCap').click())
		await waitForUi(() => expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Upgrade to Pro'))
		expect(nameField()).toBeNull()
		expect(onCustomColumnDraftChange).not.toHaveBeenCalled()
	})

	test('the column group radio narrows the column list to that group', async () => {
		await renderManager()
		expect(radio('Column group', 'All').checked).toBe(true)
		expect(container.textContent).not.toContain('No columns match')

		await act(async () => radio('Column group', 'Custom').click())
		expect(radio('Column group', 'Custom').checked).toBe(true)
		expect(container.textContent).toContain('No columns match')
	})

	test('sort direction is a radio that waits for a sort column, then flips the sort', async () => {
		const onSortingChange = vi.fn()
		await renderManager({ onSortingChange })
		expect(radio('Sort direction', 'Asc').disabled).toBe(true)
		expect(radio('Sort direction', 'Desc').checked).toBe(false)

		await renderManager({ sorting: [{ id: 'tvl', desc: true }], onSortingChange })
		expect(radio('Sort direction', 'Desc').checked).toBe(true)
		await act(async () => radio('Sort direction', 'Asc').click())
		expect(onSortingChange).toHaveBeenCalledWith([{ id: 'tvl', desc: false }])
	})
})

describe('a subscriber', () => {
	signInAs('subscriber')

	test('a custom column preset opens the form with the preset as the draft', async () => {
		const onCustomColumnDraftChange = vi.fn()
		await renderManager({ onCustomColumnDraftChange })
		await act(async () => button('TVL/MCap').click())
		expect(nameField()).not.toBeNull()
		expect(onCustomColumnDraftChange).toHaveBeenLastCalledWith({
			id: null,
			name: 'TVL/MCap',
			expression: 'tvl / mcap',
			format: 'ratio',
			aggregation: null
		})
	})

	test('the custom column format and aggregation are radio fields that update the draft', async () => {
		const onCustomColumnDraftChange = vi.fn()
		const draft: CustomColumnDraft = { ...EMPTY_CUSTOM_COLUMN_DRAFT, format: 'usd', aggregation: 'sum' }
		await renderManager({ customColumnDraft: draft, onCustomColumnDraftChange })
		await act(async () => button('Custom column').click())

		expect(radio('Format', '$').checked).toBe(true)
		expect(radio('Format', '%').getAttribute('aria-label')).toBe('Percent')
		await act(async () => radio('Format', '%').click())
		expect(onCustomColumnDraftChange).toHaveBeenLastCalledWith({ ...draft, format: 'percent' })

		expect(radio('Aggregation', 'Sum').checked).toBe(true)
		await act(async () => radio('Aggregation', 'None').click())
		expect(onCustomColumnDraftChange).toHaveBeenLastCalledWith({ ...draft, aggregation: 'none' })
	})
})

describe('with Pro', () => {
	signInAs('subscriber')

	test('adding an empty custom column says what is missing under each field, focuses the name and adds nothing', async () => {
		const onAddCustomColumn = vi.fn()
		await renderManager({ onAddCustomColumn })
		await act(async () => button('Custom column').click())
		expect(button('Add custom column').getAttribute('aria-disabled')).toBeNull()
		expect(fieldErrorTexts(container)).toEqual([])
		await act(async () => button('Add custom column').click())
		expect(fieldErrorTexts(container)).toHaveLength(2)
		expect(document.activeElement).toBe(nameField())
		expect(onAddCustomColumn).not.toHaveBeenCalled()
	})

	test('a name another custom column has says so before Add', async () => {
		await renderManager({
			customColumns: [
				{ id: 'custom_1', name: 'Ratio', expression: 'tvl / mcap', format: 'ratio', aggregation: 'none' }
			],
			customColumnDraft: { ...EMPTY_CUSTOM_COLUMN_DRAFT, name: 'ratio' }
		})
		// The toggle also counts the saved custom columns.
		await act(async () =>
			Array.from(container.querySelectorAll('button'))
				.find((element) => element.textContent?.trim().startsWith('Custom column'))!
				.click()
		)
		expect(nameField()).not.toBeNull()
		expect(fieldErrorOf(nameField()!)).toBeTruthy()
	})
})
