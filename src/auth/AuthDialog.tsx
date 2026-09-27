import * as Ariakit from '@ariakit/react'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

export const authDialogStyles = `${dialogSurfaceStyles} [--dialog-width:420px] motion-reduce:transition-none`
export const authBodyStyles = `${dialogScrollableBodyStyles} flex flex-col gap-4 p-4 sm:p-5`
// Reserve four wallet rows and the helper (two lines on mobile) while the SDK loads.
export const authWalletPickerStyles = 'min-h-62 sm:min-h-58'
export const authInputStyles =
	'peer h-10 w-full rounded-lg border border-medium bg-surface px-3 text-base sm:text-sm text-primary placeholder:text-tertiary focus:border-brand focus:outline-hidden user-invalid:border-error user-invalid:focus:border-error disabled:opacity-60'
export const authPrimaryButtonStyles =
	'flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-on-brand disabled:cursor-not-allowed disabled:opacity-60'
export const authProviderButtonStyles =
	'flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-medium bg-surface px-3 py-2 text-sm font-medium text-primary enabled:hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60'

export function AuthDialogHeader({
	title,
	prompt,
	onBack,
	showBackLabel = false,
	store,
	closeable = true
}: {
	title: string
	prompt?: string
	onBack?: () => void
	showBackLabel?: boolean
	store?: Ariakit.DialogStore
	closeable?: boolean
}) {
	return (
		<div className="shrink-0 border-b border-subtle px-4 py-3 sm:px-5">
			<div className="flex flex-wrap items-center gap-2">
				{onBack ? (
					<div className={showBackLabel ? 'w-full' : 'contents'}>
						<Button
							type="button"
							variant="ghost"
							size="md"
							square={!showBackLabel}
							className={showBackLabel ? '-ml-4' : '-ml-2'}
							onClick={onBack}
							aria-label="Back to sign in"
						>
							<Icon name="arrow-left" className="size-4" aria-hidden />
							{showBackLabel ? 'Back to sign in' : null}
						</Button>
					</div>
				) : null}
				<Ariakit.Focusable render={<DialogHeading />} autoFocus tabIndex={-1} className="flex-1 focus:outline-hidden">
					{title}
				</Ariakit.Focusable>
				{closeable ? <DialogCloseButton store={store} ariaLabel="Close" /> : null}
			</div>
			{prompt ? <p className="mt-2 text-sm text-secondary">{prompt}</p> : null}
		</div>
	)
}

export function LastUsedChip({ onPrimary = false }: { onPrimary?: boolean }) {
	return (
		<span
			className={`shrink-0 rounded-full px-2 py-0.5 label-xs whitespace-nowrap max-[380px]:px-1 ${onPrimary ? 'bg-surface text-primary' : 'bg-brand-muted text-link-on-tint'}`}
		>
			Last used
		</span>
	)
}
