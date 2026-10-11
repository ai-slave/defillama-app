// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import {
	Dialog,
	DialogBackButton,
	DialogBody,
	DialogCancelButton,
	DialogCloseButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	useDialogLeave
} from '../Dialog'
import { Tab as TabTrigger, TabPanel, Tabs } from '../Tabs'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('a pending submit button keeps focus, shows its pending label and submits nothing until it settles', async () => {
	const submit = vi.fn()
	function Form({ pending }: { pending: boolean }) {
		return (
			<form
				onSubmit={(event) => {
					event.preventDefault()
					submit()
				}}
			>
				<Button type="submit" variant="primary" size="md" pendingLabel="Saving…" pending={pending}>
					Save
				</Button>
			</form>
		)
	}
	await act(async () => root.render(<Form pending={false} />))
	const button = container.querySelector('button')!
	button.focus()
	await act(async () => root.render(<Form pending />))
	expect(document.activeElement).toBe(button)
	expect(accessibleName(button)).toBe('Saving…')
	expect(button.getAttribute('aria-disabled')).toBe('true')
	expect(button.getAttribute('aria-busy')).toBe('true')
	await act(async () => button.click())
	expect(submit).not.toHaveBeenCalled()
	await act(async () => root.render(<Form pending={false} />))
	expect(accessibleName(button)).toBe('Save')
	await act(async () => button.click())
	expect(submit).toHaveBeenCalledOnce()
})

test('a pending dialog ignores Escape, its close button and Cancel without asking, then closes again once the request settles', async () => {
	function Harness({ pending }: { pending: boolean }) {
		const [open, setOpen] = useState(true)
		return (
			<>
				{open ? null : <p>Closed</p>}
				<Dialog size="sm" open={open} onClose={() => setOpen(false)} pending={pending}>
					<DialogHeader title="Invite" />
					<DialogBody>
						<p>Body</p>
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />} />
					<DialogDiscardGuard when={pending} title="Discard this invite?" description="It is not sent." />
				</Dialog>
			</>
		)
	}
	await act(async () => root.render(<Harness pending />))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const dialog = document.querySelector<HTMLElement>('[role=dialog]')!
	const close = dialog.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!
	const cancel = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Cancel'
	)!
	expect(close.getAttribute('aria-disabled')).toBe('true')
	expect(cancel.getAttribute('aria-disabled')).toBe('true')
	await act(async () => close.click())
	await act(async () => cancel.click())
	await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	expect(container.textContent).not.toContain('Closed')
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	await act(async () => root.render(<Harness pending={false} />))
	await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	await waitForUi(() => expect(container.textContent).toContain('Closed'))
})

test('a pending dialog keeps focus on its back button and ignores it until the request settles', async () => {
	const back = vi.fn()
	function Harness({ pending }: { pending: boolean }) {
		return (
			<Dialog size="sm" open onClose={() => {}} pending={pending}>
				<DialogHeader title="New dashboard" leading={<DialogBackButton label="Back to choices" onClick={back} />} />
			</Dialog>
		)
	}
	await act(async () => root.render(<Harness pending={false} />))
	await waitForUi(() => expect(document.querySelector('[aria-label="Back to choices"]')).not.toBeNull())
	const backButton = document.querySelector<HTMLButtonElement>('[aria-label="Back to choices"]')!
	await act(async () => backButton.focus())
	await act(async () => root.render(<Harness pending />))
	expect(document.activeElement).toBe(backButton)
	expect(backButton.disabled).toBe(false)
	expect(backButton.getAttribute('aria-disabled')).toBe('true')
	await act(async () => backButton.click())
	expect(back).not.toHaveBeenCalled()
	await act(async () => root.render(<Harness pending={false} />))
	await act(async () => backButton.click())
	expect(back).toHaveBeenCalledOnce()
})

test('back asks a mounted discard guard first and leaves the step only on Discard', async () => {
	function Harness() {
		const [step, setStep] = useState<'choices' | 'form'>('form')
		return (
			<Dialog size="sm" open onClose={() => {}}>
				{step === 'form' ? (
					<>
						<DialogHeader
							title="New dashboard"
							leading={<DialogBackButton label="Back to choices" onClick={() => setStep('choices')} />}
						/>
						<DialogDiscardGuard when title="Discard this dashboard?" description="It is not created." />
					</>
				) : (
					<DialogHeader title="Choices" />
				)}
			</Dialog>
		)
	}
	await act(async () => root.render(<Harness />))
	await waitForUi(() => expect(document.querySelector('[aria-label="Back to choices"]')).not.toBeNull())
	const named = (name: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)!
	const heading = () => document.querySelector('[role="dialog"] h2')?.textContent

	await act(async () => named('Back to choices').click())
	await waitForUi(() =>
		expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard this dashboard?')
	)
	expect(heading()).toBe('New dashboard')
	await act(async () => named('Keep editing').click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	expect(heading()).toBe('New dashboard')

	await act(async () => named('Back to choices').click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
	await act(async () => named('Discard').click())
	await waitForUi(() => expect(heading()).toBe('Choices'))
})

test('the header subtitle is announced as the dialog description', async () => {
	await act(async () =>
		root.render(
			<Dialog size="sm" open onClose={() => {}}>
				<DialogHeader title="Chart metrics" subtitle="3 of 40 selected" />
			</Dialog>
		)
	)
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const describedBy = document.querySelector('[role=dialog]')!.getAttribute('aria-describedby')
	expect(describedBy && document.getElementById(describedBy)?.textContent).toBe('3 of 40 selected')
})

test('a discard guard turns Escape, the ×, Cancel and guarded steps into its prompt, and outside taps do nothing', async () => {
	function Tab() {
		const leave = useDialogLeave()
		const [tab, setTab] = useState('Balance')
		return (
			<button type="button" onClick={() => leave(() => setTab('Memory'))}>
				Tab {tab}
			</button>
		)
	}
	function Harness() {
		const [open, setOpen] = useState(true)
		return (
			<>
				{open ? null : <p>Closed</p>}
				<Dialog size="sm" open={open} onClose={() => setOpen(false)}>
					<DialogHeader title="Top up" />
					<DialogBody>
						<Tab />
						<DialogDiscardGuard when title="Discard this draft?" description="It is not saved." />
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />} />
				</Dialog>
			</>
		)
	}
	await act(async () => root.render(<Harness />))
	const dialog = document.querySelector('[role="dialog"]')!
	const named = (name: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)!
	const keepEditing = async () => {
		await waitForUi(() =>
			expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard this draft?')
		)
		await act(async () => named('Keep editing').click())
		await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	}

	await act(async () =>
		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
	await keepEditing()
	await act(async () => named('Close dialog').click())
	await keepEditing()
	await act(async () => named('Cancel').click())
	await keepEditing()
	await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
	await act(async () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })))
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	expect(container.textContent).not.toContain('Closed')

	await act(async () => named('Tab Balance').click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
	expect(dialog.textContent).toContain('Tab Balance')
	await act(async () => named('Discard').click())
	await waitForUi(() => expect(dialog.textContent).toContain('Tab Memory'))
	expect(container.textContent).not.toContain('Closed')

	await act(async () => named('Cancel').click())
	await act(async () => named('Discard').click())
	await waitForUi(() => expect(container.textContent).toContain('Closed'))
})

test('a confirmed discard that unmounts its dialog leaves focus on the opener still on the page', async () => {
	function Harness() {
		const [open, setOpen] = useState(false)
		return (
			<main tabIndex={-1}>
				<button type="button" onClick={() => setOpen(true)}>
					Purchase seats
				</button>
				{open ? (
					<Dialog size="sm" open onClose={() => setOpen(false)}>
						<DialogHeader title="Checkout" />
						<DialogBody>
							<DialogDiscardGuard when title="Leave checkout?" description="The payment is not finished." />
						</DialogBody>
					</Dialog>
				) : null}
			</main>
		)
	}
	await act(async () => root.render(<Harness />))
	const opener = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Purchase seats'
	)!
	await act(async () => {
		opener.focus()
		opener.click()
	})
	const dialog = await waitForUi(() => document.querySelector<HTMLElement>('[role="dialog"]')!)
	await act(async () =>
		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
	)
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
	await act(async () =>
		[...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')]
			.find((button) => button.textContent === 'Discard')!
			.click()
	)
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(opener))
})

test.each(['Cancel', 'Close dialog'])(
	'%s inside a tab panel closes the dialog, asking first while a guard is mounted',
	async (control) => {
		function Harness({ guarded }: { guarded: boolean }) {
			const store = Ariakit.useDialogStore({ defaultOpen: true })
			const open = Ariakit.useStoreState(store, 'open')
			const [tab, setTab] = useState('table')
			return (
				<>
					{open ? null : <p>Closed</p>}
					<Ariakit.DialogProvider store={store}>
						<Dialog size="sm">
							<Tabs value={tab} values={['chart', 'table']} onValueChange={setTab}>
								<DialogHeader title="Add card" />
								<Ariakit.TabList aria-label="Card type">
									<TabTrigger value="chart">Chart</TabTrigger>
									<TabTrigger value="table">Table</TabTrigger>
								</Ariakit.TabList>
								<TabPanel value="table">
									<DialogDiscardGuard when={guarded} title="Discard this card?" description="It is not added." />
									<DialogCloseButton />
									<DialogFooter dismiss={<DialogCancelButton />} />
								</TabPanel>
							</Tabs>
						</Dialog>
					</Ariakit.DialogProvider>
				</>
			)
		}
		const named = (name: string) =>
			[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)!

		await act(async () => root.render(<Harness guarded={false} />))
		await act(async () => named(control).click())
		await waitForUi(() => expect(container.textContent).toContain('Closed'))

		await act(async () => root.render(null))
		await act(async () => root.render(<Harness guarded />))
		await act(async () => named(control).click())
		await waitForUi(() =>
			expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard this card?')
		)
		await act(async () => named('Discard').click())
		await waitForUi(() => expect(container.textContent).toContain('Closed'))
	}
)

test('without a guard, a guarded step runs at once', async () => {
	function Tab() {
		const leave = useDialogLeave()
		const [tab, setTab] = useState('Balance')
		return (
			<button type="button" onClick={() => leave(() => setTab('Memory'))}>
				Tab {tab}
			</button>
		)
	}
	await act(async () =>
		root.render(
			<Dialog size="sm" open>
				<DialogHeader title="Settings" />
				<Tab />
			</Dialog>
		)
	)
	await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Tab Balance')!.click())
	expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Tab Memory')
})

test('a pending button stays focusable even when its caller also disables it', async () => {
	await act(async () =>
		root.render(
			<Button type="button" size="md" disabled pendingLabel="Saving…" pending>
				Save
			</Button>
		)
	)
	const button = container.querySelector('button')!
	expect(button.disabled).toBe(false)
	expect(button.getAttribute('aria-disabled')).toBe('true')
	await act(async () => button.focus())
	expect(document.activeElement).toBe(button)
})

test('a button without a type does not submit the form around it', async () => {
	const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
	await act(async () =>
		root.render(
			<form onSubmit={submit}>
				<Button size="md">Show more</Button>
				<Button type="submit" size="md">
					Save
				</Button>
			</form>
		)
	)
	const [showMore, save] = container.querySelectorAll('button')
	await act(async () => showMore.click())
	expect(submit).not.toHaveBeenCalled()
	await act(async () => save.click())
	expect(submit).toHaveBeenCalledOnce()
})

test('a control that disables itself when pressed keeps focus', async () => {
	function Stepper() {
		const [seats, setSeats] = useState(2)
		return (
			<Button
				size="md"
				aria-label="Decrease seats"
				disabled={seats === 1}
				accessibleWhenDisabled
				onClick={() => setSeats(seats - 1)}
			>
				{seats}
			</Button>
		)
	}
	await act(async () => root.render(<Stepper />))
	const button = container.querySelector('button')!
	await act(async () => {
		button.focus()
		button.click()
	})
	expect(button.textContent).toBe('1')
	expect(button.disabled).toBe(false)
	expect(button.getAttribute('aria-disabled')).toBe('true')
	expect(document.activeElement).toBe(button)
	await act(async () => button.click())
	expect(button.textContent).toBe('1')
})

function RowsDialog({ rows, disabled }: { rows: Array<string>; disabled?: Array<string> }) {
	return (
		<Dialog size="sm" open onClose={() => {}}>
			<DialogHeader title="Rows" />
			<DialogBody>
				{rows.map((row) => (
					<Button key={row} size="md" disabled={disabled?.includes(row)}>
						{row}
					</Button>
				))}
			</DialogBody>
		</Dialog>
	)
}

async function openRowsDialog(rows: Array<string>) {
	await act(async () => root.render(<RowsDialog rows={rows} />))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const dialog = document.querySelector<HTMLElement>('[role=dialog]')!
	const named = (name: string) =>
		[...dialog.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)!
	return { dialog, named }
}

test('a focused control that an update removes hands focus to the dialog, not the page', async () => {
	const { named } = await openRowsDialog(['Alpha', 'Beta'])
	await act(async () => named('Beta').focus())
	await act(async () => root.render(<RowsDialog rows={['Alpha']} />))
	expect(document.activeElement).toBe(named('Close dialog'))
})

test('a removal that blurs the control first, as Chrome does, still hands focus to the dialog', async () => {
	const { named } = await openRowsDialog(['Alpha', 'Beta'])
	const beta = named('Beta')
	await act(async () => beta.focus())
	// Chrome fires focusout with no relatedTarget on the control it is about to remove; happy-dom fires nothing.
	await act(async () => {
		beta.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }))
		root.render(<RowsDialog rows={['Alpha']} />)
	})
	expect(document.activeElement).toBe(named('Close dialog'))
})

test('a focused control that an update disables hands focus to the dialog, not the page', async () => {
	const { named } = await openRowsDialog(['Alpha', 'Beta'])
	const beta = named('Beta')
	await act(async () => beta.focus())
	await act(async () => root.render(<RowsDialog rows={['Alpha', 'Beta']} disabled={['Beta']} />))
	expect(beta.disabled).toBe(true)
	expect(document.activeElement).toBe(named('Close dialog'))
})

test('the dialog leaves focus alone when the update moves it somewhere itself', async () => {
	function Steps({ step }: { step: 'choose' | 'name' }) {
		return (
			<Dialog size="sm" open onClose={() => {}}>
				<DialogHeader title="New dashboard" />
				<DialogBody>
					{step === 'choose' ? <Button size="md">Start blank</Button> : <input aria-label="Dashboard name" autoFocus />}
				</DialogBody>
			</Dialog>
		)
	}
	await act(async () => root.render(<Steps step="choose" />))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const start = [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find(
		(button) => accessibleName(button) === 'Start blank'
	)!
	await act(async () => start.focus())
	await act(async () => root.render(<Steps step="name" />))
	expect(document.activeElement).toBe(document.querySelector('[aria-label="Dashboard name"]'))
})

test('focus inside a nested dialog stays there when the dialog behind it updates', async () => {
	function Nested({ rows }: { rows: Array<string> }) {
		return (
			<Dialog size="sm" open onClose={() => {}}>
				<DialogHeader title="Rows" />
				<DialogBody>
					{rows.map((row) => (
						<Button key={row} size="md">
							{row}
						</Button>
					))}
					<Dialog size="sm" open onClose={() => {}}>
						<DialogHeader title="Confirm" closable={false} />
						<DialogBody>
							<Button size="md">Delete</Button>
						</DialogBody>
					</Dialog>
				</DialogBody>
			</Dialog>
		)
	}
	await act(async () => root.render(<Nested rows={['Alpha', 'Beta']} />))
	await waitForUi(() => expect(document.querySelectorAll('[role=dialog]').length).toBe(2))
	const confirm = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => accessibleName(button) === 'Delete'
	)!
	await act(async () => confirm.focus())
	await act(async () => root.render(<Nested rows={['Alpha']} />))
	expect(document.activeElement).toBe(confirm)
})

test('a confirmation that closes after an update removed its trigger hands focus to the dialog behind it', async () => {
	function Rows({ rows, confirming }: { rows: Array<string>; confirming: boolean }) {
		return (
			<Dialog size="sm" open onClose={() => {}}>
				<DialogHeader title="Rows" />
				<DialogBody>
					{rows.map((row) => (
						<Button key={row} size="md">
							{row}
						</Button>
					))}
					<Dialog size="sm" open={confirming} onClose={() => {}} unmountOnHide>
						<DialogHeader title="Delete Beta?" closable={false} />
						<DialogBody>
							<Button size="md">Delete</Button>
						</DialogBody>
					</Dialog>
				</DialogBody>
			</Dialog>
		)
	}
	await act(async () => root.render(<Rows rows={['Alpha', 'Beta']} confirming />))
	await waitForUi(() => expect(document.querySelectorAll('[role=dialog]').length).toBe(2))
	const named = (name: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)
	await act(async () => named('Delete')!.focus())
	await act(async () => root.render(<Rows rows={['Alpha']} confirming />))
	await act(async () => root.render(<Rows rows={['Alpha']} confirming={false} />))
	await waitForUi(() => expect(document.querySelectorAll('[role=dialog]').length).toBe(1))
	await waitForUi(() => expect(document.activeElement).toBe(named('Close dialog')))
})

test.each([
	['stays mounted while hidden', false],
	['unmounts on hide', true]
])('canceling a confirmation that %s returns focus to the button that opened it', async (_, unmountOnHide) => {
	function Rows() {
		const confirm = Ariakit.useDialogStore()
		return (
			<Dialog size="sm" open onClose={() => {}}>
				<DialogHeader title="Rows" />
				<DialogBody>
					<Button size="md">Alpha</Button>
					<Button size="md" onClick={confirm.show}>
						Delete Beta
					</Button>
					<ConfirmDialog
						store={confirm}
						portal
						unmountOnHide={unmountOnHide}
						title="Delete Beta?"
						description="Beta goes away."
						confirmLabel="Delete"
						error={null}
						onConfirm={() => {}}
					/>
				</DialogBody>
			</Dialog>
		)
	}
	await act(async () => root.render(<Rows />))
	await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
	const named = (name: string) =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)
	const trigger = named('Delete Beta')!
	await act(async () => {
		trigger.focus()
		trigger.click()
	})
	await waitForUi(() => expect(document.querySelector('[role=alertdialog]')).not.toBeNull())
	await act(async () => named('Cancel')!.click())
	await waitForUi(() => expect(document.querySelector('[role=alertdialog]:not([hidden])')).toBeNull())
	await new Promise((resolve) => setTimeout(resolve, 50))
	expect(document.activeElement).toBe(trigger)
})

test.each([
	['stays mounted while hidden', false],
	['unmounts on hide', true]
])(
	'a confirmation that %s and names its own fallback keeps that target when its trigger is gone',
	async (_, unmountOnHide) => {
		function Integration() {
			const confirm = Ariakit.useDialogStore()
			const [linked, setLinked] = useState(true)
			return (
				<Dialog size="sm" open onClose={() => {}}>
					<DialogHeader title="Integrations" />
					<DialogBody>
						{linked ? (
							<Button size="md" onClick={confirm.show}>
								Disconnect
							</Button>
						) : (
							<Button size="md" data-connect="">
								Connect
							</Button>
						)}
						<ConfirmDialog
							store={confirm}
							portal
							unmountOnHide={unmountOnHide}
							autoFocusOnHide={(element) => {
								if (element?.isConnected) return true
								document.querySelector<HTMLElement>('[data-connect]')?.focus()
								return false
							}}
							title="Disconnect?"
							description="Alerts stop."
							confirmLabel="Disconnect"
							error={null}
							onConfirm={() => {
								setLinked(false)
								confirm.hide()
							}}
						/>
					</DialogBody>
				</Dialog>
			)
		}
		await act(async () => root.render(<Integration />))
		await waitForUi(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
		const named = (name: string) =>
			[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => accessibleName(button) === name)
		await act(async () => {
			named('Disconnect')!.focus()
			named('Disconnect')!.click()
		})
		await waitForUi(() => expect(document.querySelector('[role=alertdialog]')).not.toBeNull())
		const confirmButton = [...document.querySelectorAll<HTMLButtonElement>('[role=alertdialog] button')].find(
			(button) => accessibleName(button) === 'Disconnect'
		)!
		await act(async () => confirmButton.click())
		await waitForUi(() => expect(named('Connect')).toBeDefined())
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(document.activeElement).toBe(named('Connect'))
	}
)
