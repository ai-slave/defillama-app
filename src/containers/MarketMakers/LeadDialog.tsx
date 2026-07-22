import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

export function LeadDialog({
	open,
	onClose,
	title,
	children,
	footer,
	showHeader = true
}: {
	open: boolean
	onClose: () => void
	title: ReactNode
	children: ReactNode
	footer?: ReactNode
	showHeader?: boolean
}) {
	return (
		<Ariakit.DialogProvider open={open} setOpen={(value) => !value && onClose()}>
			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:520px]`}
				backdrop={<div className="fixed inset-0 z-50 bg-screen-dim" />}
				hideOnInteractOutside={false}
				portal
				unmountOnHide
			>
				{showHeader ? (
					<div className="flex items-center justify-between gap-3 border-b border-subtle p-3">
						<DialogHeading>{title}</DialogHeading>
						<DialogCloseButton className="-mr-1" />
					</div>
				) : (
					<>
						<Ariakit.VisuallyHidden>
							<DialogHeading>{title}</DialogHeading>
						</Ariakit.VisuallyHidden>
						<DialogCloseButton className="absolute top-3 right-3 z-10" />
					</>
				)}
				<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-3`}>{children}</div>
				{footer ? <div className="flex items-center justify-end gap-2 border-t border-subtle p-3">{footer}</div> : null}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
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
