import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { DialogBody, DialogFooter, DialogHeader, dialogSurfaceStyles } from '~/ui/Dialog'

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

export function LeadField({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="label-sm text-primary">{label}</span>
			{children}
			{error ? <span className="body-sm text-error">{error}</span> : null}
		</label>
	)
}

export function LeadCancelButton() {
	return <Ariakit.DialogDismiss render={<Button type="button" size="md" />}>Cancel</Ariakit.DialogDismiss>
}

/** The outcome step: the header names the outcome, one plain sentence says what happens next, and Done closes. */
export function LeadSuccess({ title, message }: { title: string; message: string }) {
	return (
		<>
			<DialogHeader title={title} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">{message}</Ariakit.DialogDescription>
			</DialogBody>
			<DialogFooter>
				{/* The submit button that had focus is gone, so focus moves to the only action. */}
				<Ariakit.DialogDismiss autoFocus render={<Button type="button" variant="primary" size="md" />}>
					Done
				</Ariakit.DialogDismiss>
			</DialogFooter>
		</>
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
