// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { EMPTY_CUSTOM_COLUMN_DRAFT } from '../../hooks/useUnifiedTableWizard'
import { ColumnManager } from '../ColumnManager'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))

const session = installSubscriberSession('u1', { account: 'free', resolved: true })
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('without Pro a custom column preset offers the upgrade instead of opening the form', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ColumnManager
					rowHeaders={['protocol']}
					columnOrder={['name', 'tvl']}
					columnVisibility={{}}
					onChange={vi.fn()}
					customColumns={[]}
					onAddCustomColumn={vi.fn()}
					onUpdateCustomColumn={vi.fn()}
					onRemoveCustomColumn={vi.fn()}
					customColumnDraft={EMPTY_CUSTOM_COLUMN_DRAFT}
					onCustomColumnDraftChange={vi.fn()}
					sorting={[]}
					onSortingChange={vi.fn()}
					onSortingReset={vi.fn()}
				/>
			</session.Wrapper>
		)
	)
	const preset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'TVL/MCap')!
	await act(async () => preset.click())
	expect(container.querySelector('[aria-label="Custom column name"]')).toBeNull()
})
