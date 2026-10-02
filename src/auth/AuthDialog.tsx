import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { DialogBackButton, DialogHeader } from '~/ui/Dialog'

// Reserve four wallet rows and the helper (two lines on mobile) while the SDK loads.
export const authWalletPickerStyles = 'min-h-62 sm:min-h-58'
// Kept off ~/ui/Input: `peer` drives the FieldError sibling and user-invalid draws the error border from native
// validation without React state, and the 40px field seats the 32px password-eye button inside it.
export const authInputStyles =
	'peer h-10 w-full rounded-lg border border-medium bg-surface px-3 text-base sm:body-md text-primary placeholder:text-tertiary focus:border-brand focus:outline-hidden user-invalid:border-error user-invalid:focus:border-error aria-invalid:border-error aria-invalid:focus:border-error disabled:opacity-60'
// Sign-in method buttons keep a centred label; the "Last used" chip sits on the top-right corner (LastUsedCorner),
// so no label moves to make room at any width. A pending spinner takes the icon's slot.
export const authProviderButtonStyles =
	'relative flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-medium px-3 py-2 label-md text-primary enabled:hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60'
// Wallet picker rows list choices with their tags, so they read left to right.
export const authWalletRowStyles =
	'relative flex min-h-10 w-full items-center gap-2 rounded-lg border border-medium px-3 py-2 text-left label-md text-primary enabled:hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60'
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
		<span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 label-xs whitespace-nowrap text-link-on-tint">
			Last used
		</span>
	)
}
