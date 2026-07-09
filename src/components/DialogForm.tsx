import * as Ariakit from '@ariakit/react'
import { useRef } from 'react'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Input } from '~/ui/Input'

export function DialogForm({
	open,
	setOpen,
	title,
	description,
	onSubmit
}: {
	open: boolean
	setOpen: (value: boolean) => void
	title: string
	description: string
	onSubmit: (name: string) => void
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	return (
		<Ariakit.Dialog
			open={open}
			onClose={() => setOpen(false)}
			modal={true}
			initialFocus={inputRef}
			className={`${dialogSurfaceStyles} [--dialog-width:480px]`}
			portal
		>
			<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
				<DialogHeading>{title}</DialogHeading>
				<DialogCloseButton />
			</div>
			<form
				id="newPortfolio"
				className="flex flex-col gap-3 px-4 py-3"
				onSubmit={(e) => {
					e.preventDefault()
					const form = e.target as HTMLFormElement
					const formData = new FormData(form)
					const nameValue = formData.get('name')
					const name = typeof nameValue === 'string' ? nameValue : ''
					onSubmit(name)
					setOpen(false)
					form.reset()
				}}
			>
				<label className="flex flex-col gap-1">
					<span className="body-sm text-secondary">{description}</span>
					<Input ref={inputRef} required name="name" />
				</label>
			</form>
			<div className="flex justify-end border-t border-subtle bg-overlay px-4 py-3">
				<Button type="submit" form="newPortfolio" variant="primary" size="md">
					Save
				</Button>
			</div>
		</Ariakit.Dialog>
	)
}
