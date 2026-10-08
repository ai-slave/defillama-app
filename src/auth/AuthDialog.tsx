import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { DialogBackButton, DialogHeader } from '~/ui/Dialog'

// Reserve four wallet rows and the helper (two lines on mobile) while the SDK loads.
export const authWalletPickerStyles = 'min-h-62 sm:min-h-58'
// Sign-in method buttons keep a centred label; the "Last used" chip sits on the top-right corner (LastUsedCorner),
// so no label moves to make room at any width. A pending spinner takes the icon's slot.
export const authProviderButtonStyles =
	'relative flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-medium px-3 py-2 label-md text-primary not-disabled:not-aria-disabled:hover:bg-hover-row disabled:cursor-not-allowed disabled:text-disabled disabled:border-disabled aria-disabled:cursor-not-allowed aria-disabled:text-disabled aria-disabled:border-disabled'
// Wallet picker rows list choices with their tags, so they read left to right.
export const authWalletRowStyles =
	'relative flex min-h-10 w-full items-center gap-2 rounded-lg border border-medium px-3 py-2 text-left label-md text-primary not-disabled:not-aria-disabled:hover:bg-hover-row disabled:cursor-not-allowed disabled:text-disabled disabled:border-disabled aria-disabled:cursor-not-allowed aria-disabled:text-disabled aria-disabled:border-disabled'
export const authProviderIconSlotStyles = 'flex size-5 shrink-0 items-center justify-center'

/** The auth header: the title takes focus on every mount (callers key it by step), so a step change is announced. */
export function AuthDialogHeader({
	title,
	prompt,
	onBack,
	closable = true
}: {
	title: string
	prompt?: ReactNode
	onBack?: () => void
	closable?: boolean
}) {
	return (
		<DialogHeader
			title={
				<Ariakit.Focusable render={<span />} autoFocus tabIndex={-1} className="focus:outline-hidden">
					{title}
				</Ariakit.Focusable>
			}
			subtitle={prompt}
			leading={onBack ? <DialogBackButton label="Back to sign in" onClick={onBack} /> : null}
			closable={closable}
		/>
	)
}

/** The chip straddling a method button's top border. The dialog fill behind it hides the border line under the tinted pill. */
export function LastUsedCorner() {
	return (
		<span className="pointer-events-none absolute -top-2 right-3 rounded-full bg-overlay">
			<LastUsedChip />
		</span>
	)
}

export function LastUsedChip() {
	return (
		<span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 label-xs whitespace-nowrap text-link">
			Last used
		</span>
	)
}
