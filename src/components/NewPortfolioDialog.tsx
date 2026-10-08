import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input } from '~/ui/Input'

/** The watchlists' "New portfolio" dialog: one name field, checked against the portfolios that exist. */
export function NewPortfolioDialog({
	open,
	setOpen,
	portfolios,
	onCreate
}: {
	open: boolean
	setOpen: (value: boolean) => void
	portfolios: ReadonlyArray<string>
	onCreate: (name: string) => void
}) {
	const opening = useOpeningKey(open)
	return (
		<Dialog size="sm" open={open} onClose={() => setOpen(false)} unmountOnHide portal>
			<NewPortfolioForm
				key={opening}
				portfolios={portfolios}
				onCreate={(name) => {
					onCreate(name)
					setOpen(false)
				}}
			/>
		</Dialog>
	)
}

/** A blank name would make an unnamed portfolio, and an existing one would only switch to that portfolio, so both
    are refused. Names compare ignoring case, so "main" cannot sit beside "Main". */
export function findPortfolioNameError(name: string, portfolios: ReadonlyArray<string>): string | null {
	const trimmed = name.trim()
	if (!trimmed) return 'Enter a name.'
	const key = trimmed.toLowerCase()
	return portfolios.some((portfolio) => portfolio.toLowerCase() === key) ? 'A portfolio with this name exists.' : null
}

function NewPortfolioForm({
	portfolios,
	onCreate
}: {
	portfolios: ReadonlyArray<string>
	onCreate: (name: string) => void
}) {
	const [name, setName] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const error = findPortfolioNameError(name, portfolios)

	return (
		<form
			noValidate
			className="flex min-h-0 flex-auto flex-col"
			onSubmit={(event) => {
				event.preventDefault()
				if (error) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
				onCreate(name.trim())
			}}
		>
			<DialogHeader title="New portfolio" />
			<DialogBody>
				<Field label="Name" error={submitted ? error : null}>
					{(control) => (
						<Ariakit.Focusable
							autoFocus
							render={
								<Input {...control} name="name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
							}
						/>
					)}
				</Field>
			</DialogBody>
			<DialogFooter dismiss={<DialogCancelButton />}>
				<Button type="submit" variant="primary" size="md">
					Create
				</Button>
			</DialogFooter>
		</form>
	)
}
