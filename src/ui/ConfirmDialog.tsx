import * as Ariakit from '@ariakit/react'
import type { ComponentProps, ReactNode } from 'react'
import { Button } from './Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './Dialog'
import { InlineStatus } from './Status'

/* The confirmation layout: title, what happens, then Cancel and the confirm
   action. Cancel stays visible at every width and there is no ×, because the
   choice is the footer. While `pendingLabel` is set the dialog cannot be
   closed and both buttons are inert; `waitingLabel` shows a check the
   choice waits on in the confirm button without locking the dialog; `error`
   shows above the footer.
   role="alertdialog" only for destructive or irreversible choices. */
export function ConfirmDialog({
	title,
	description,
	confirmLabel,
	cancelLabel = 'Cancel',
	pendingLabel,
	waitingLabel = null,
	error,
	confirmDisabled = false,
	tone = 'destructive',
	onConfirm,
	...props
}: {
	title: string
	description: ReactNode
	confirmLabel: string
	/** Name the safe choice when "Cancel" would be ambiguous, e.g. "Keep draft" beside "Discard draft". */
	cancelLabel?: string
	/** Set while the confirmed action runs. */
	pendingLabel: string | null
	/** Set while something the choice depends on settles, e.g. "Refreshing…"; Cancel stays available. */
	waitingLabel?: string | null
	error: ReactNode
	/** The choice is unavailable right now; the description must say why. */
	confirmDisabled?: boolean
	tone?: 'destructive' | 'primary'
	onConfirm: () => void
} & Omit<ComponentProps<typeof Dialog>, 'size' | 'role' | 'children' | 'pending'>) {
	const pending = pendingLabel !== null
	return (
		<Dialog size="sm" role={tone === 'destructive' ? 'alertdialog' : 'dialog'} pending={pending} {...props}>
			<DialogHeader title={title} closable={false} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">{description}</Ariakit.DialogDescription>
				{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
			</DialogBody>
			<DialogFooter>
				<Ariakit.DialogDismiss autoFocus disabled={pending} accessibleWhenDisabled render={<Button size="md" />}>
					{cancelLabel}
				</Ariakit.DialogDismiss>
				<Button
					type="button"
					size="md"
					variant={tone}
					pendingLabel={pendingLabel ?? waitingLabel}
					disabled={confirmDisabled}
					onClick={onConfirm}
				>
					{confirmLabel}
				</Button>
			</DialogFooter>
			<span role="status" className="sr-only">
				{pendingLabel ?? waitingLabel ?? ''}
			</span>
		</Dialog>
	)
}
