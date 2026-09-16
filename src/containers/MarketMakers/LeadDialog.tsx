import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

/**
 * Shell only. The header, body and footer are rendered by the form inside, so that the form — and every
 * piece of state it owns — lives under `unmountOnHide` and starts fresh on each open, instead of being
 * reset field by field.
 */
export function LeadDialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
	return (
		<Ariakit.DialogProvider open={open} setOpen={(value) => !value && onClose()}>
			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:520px]`}
				backdrop={<div className="fixed inset-0 z-50 bg-screen-dim" />}
				hideOnInteractOutside={false}
				portal
				unmountOnHide
			>
				{children}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

/** The heading is always rendered for assistive tech; `hidden` only takes it out of the visual flow. */
export function LeadDialogHeader({ title, hidden = false }: { title: ReactNode; hidden?: boolean }) {
	if (hidden) {
		return (
			<>
				<Ariakit.VisuallyHidden>
					<DialogHeading>{title}</DialogHeading>
				</Ariakit.VisuallyHidden>
				<DialogCloseButton className="absolute top-3 right-5 z-10" />
			</>
		)
	}
	return (
		<div className="flex items-center justify-between gap-3 border-b border-subtle p-3">
			<DialogHeading>{title}</DialogHeading>
			<DialogCloseButton />
		</div>
	)
}

export function LeadDialogBody({ children }: { children: ReactNode }) {
	return <div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-3`}>{children}</div>
}

export function LeadDialogFooter({ children }: { children: ReactNode }) {
	return <div className="flex items-center justify-end gap-2 border-t border-subtle p-3">{children}</div>
}

export function LeadField({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="label-md text-primary">{label}</span>
			{children}
			{error ? <span className="body-sm text-error">{error}</span> : null}
		</label>
	)
}

export function LeadCancelButton() {
	return <Ariakit.DialogDismiss render={<Button type="button" size="md" />}>Cancel</Ariakit.DialogDismiss>
}

export function LeadSuccess({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
	return (
		<div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
			<span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
				<Icon name="check" height={24} width={24} />
			</span>
			<h3 className="heading-sm text-primary">{title}</h3>
			<p className="max-w-[400px] body-sm text-secondary">{message}</p>
			<Button type="button" size="md" onClick={onClose} className="mt-2 w-full sm:w-2/3">
				Got It
			</Button>
		</div>
	)
}

export function LeadError({ message }: { message: string }) {
	return <p className="body-sm text-error">{message}</p>
}

export function LeadHoneypot({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	return (
		<input
			type="text"
			name="hp"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			tabIndex={-1}
			autoComplete="off"
			aria-hidden
			className="absolute -left-[9999px] h-0 w-0 opacity-0"
		/>
	)
}
