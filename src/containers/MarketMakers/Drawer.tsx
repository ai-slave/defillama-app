import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { DialogHeading } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

export function Drawer({
	open,
	onClose,
	title,
	children,
	widthClassName = 'sm:max-w-xl',
	dismissible = true,
	headerExtra
}: {
	open: boolean
	onClose: () => void
	title: ReactNode
	children: ReactNode
	widthClassName?: string
	dismissible?: boolean
	headerExtra?: ReactNode
}) {
	return (
		<Ariakit.DialogProvider open={open} setOpen={(value) => !value && onClose()}>
			<Ariakit.Dialog
				className={`fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-full translate-x-full flex-col border-l border-medium bg-surface-elevated-1 shadow-dialog transition-transform duration-300 ease-in-out data-enter:translate-x-0 data-leave:translate-x-full dark:shadow-dialog-deep ${widthClassName}`}
				backdrop={
					<div className="fixed inset-0 z-40 bg-screen-dim opacity-0 transition-opacity duration-300 ease-in-out data-enter:opacity-100" />
				}
				hideOnInteractOutside={dismissible}
				hideOnEscape={dismissible}
				portal
				unmountOnHide
			>
				<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<DialogHeading>{title}</DialogHeading>
					<span className="flex items-center gap-2">
						{headerExtra}
						<Ariakit.DialogDismiss
							render={<Button type="button" variant="ghost" size="md" square className="-mr-1" />}
							aria-label="Close"
						>
							<Icon name="x" height={16} width={16} />
							<span className="sr-only">Close drawer</span>
						</Ariakit.DialogDismiss>
					</span>
				</div>
				<div className="flex flex-1 flex-col gap-4 overflow-y-auto">{children}</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
