import * as Ariakit from '@ariakit/react'
import { Icon } from '~/components/Icon'

export function VerifyEmailConfirmDialog({
	isOpen,
	onConfirm,
	onClose
}: {
	isOpen: boolean
	onConfirm: () => void
	onClose: () => void
}) {
	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && onClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/60" />}
				className="dialog top-1/2 right-auto bottom-auto left-1/2 m-0 max-h-[90dvh] min-h-0 w-[calc(100vw-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-y-auto rounded-2xl bg-signin-bg px-5 pt-6 pb-5 shadow-2xl"
				portal
				unmountOnHide
			>
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-xl font-semibold text-primary">Verify your email</h2>
					<Ariakit.DialogDismiss className="rounded-full p-1 text-tertiary transition-colors hover:text-primary">
						<Icon name="x" height={20} width={20} />
						<span className="sr-only">Close</span>
					</Ariakit.DialogDismiss>
				</div>
				<p className="mb-5 text-sm text-secondary">
					You need to verify your email before you can subscribe. Do you want to verify it now?
				</p>
				<div className="flex flex-col gap-2">
					<button
						onClick={onConfirm}
						className="w-full rounded-lg border border-sub-purple bg-sub-purple py-3 text-sm font-medium text-on-brand transition-colors hover:bg-sub-purple-hover"
					>
						Verify now
					</button>
					<Ariakit.DialogDismiss className="w-full rounded-lg border border-medium py-3 text-sm font-medium text-secondary transition-colors hover:text-primary">
						Not now
					</Ariakit.DialogDismiss>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
