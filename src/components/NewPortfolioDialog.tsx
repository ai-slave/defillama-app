import * as Ariakit from '@ariakit/react'
import { useId, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
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
	const fieldId = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const trimmed = name.trim()
	const error = submitted ? findPortfolioNameError(name, portfolios) : null

	return (
		<form
			className="flex min-h-0 flex-auto flex-col"
			onSubmit={(event) => {
				event.preventDefault()
				setSubmitted(true)
				// A refused name sends focus back to the field, so its error is read out with it.
				if (findPortfolioNameError(name, portfolios)) inputRef.current?.focus()
				else onCreate(trimmed)
			}}
		>
			<DialogHeader title="New portfolio" />
			<DialogBody>
				<div className="flex flex-col gap-1">
					<label htmlFor={fieldId} className="label-sm text-secondary">
						Name
					</label>
					<Ariakit.Focusable
						autoFocus
						render={
							<Input
								ref={inputRef}
								id={fieldId}
								name="name"
								value={name}
								onChange={(event) => setName(event.currentTarget.value)}
								aria-invalid={error ? true : undefined}
								aria-describedby={error ? `${fieldId}-error` : undefined}
							/>
						}
					/>
					{error ? (
						<p id={`${fieldId}-error`} className="body-sm text-data-down">
							{error}
						</p>
					) : null}
				</div>
			</DialogBody>
			<DialogFooter dismiss={<DialogCancelButton />}>
				<Button type="submit" variant="primary" size="md">
					Create
				</Button>
			</DialogFooter>
		</form>
	)
}
