import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Icon } from '~/components/Icon'

export function Drawer({
	open,
	onClose,
	title,
	children,
	widthClassName = 'sm:max-w-xl'
}: {
	open: boolean
	onClose: () => void
	title: ReactNode
	children: ReactNode
	widthClassName?: string
}) {
	return (
		<Ariakit.DialogProvider open={open} setOpen={(value) => !value && onClose()}>
			<Ariakit.Dialog
				className={`fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-full translate-x-full flex-col border-l border-(--cards-border) bg-(--cards-bg) shadow-2xl transition-transform duration-300 ease-in-out data-enter:translate-x-0 data-leave:translate-x-full ${widthClassName}`}
				backdrop={
					<div className="fixed inset-0 z-40 bg-black/60 opacity-0 transition-opacity duration-300 ease-in-out data-enter:opacity-100" />
				}
				portal
				unmountOnHide
			>
				<div className="flex items-center justify-between gap-2 border-b border-(--cards-border) p-4">
					<Ariakit.DialogHeading className="text-lg font-medium">{title}</Ariakit.DialogHeading>
					<Ariakit.DialogDismiss
						className="-my-1 rounded-lg p-2 text-(--text-tertiary) hover:bg-(--divider) hover:text-(--text-primary)"
						aria-label="Close"
					>
						<Icon name="x" height={20} width={20} />
						<span className="sr-only">Close drawer</span>
					</Ariakit.DialogDismiss>
				</div>
				<div className="flex flex-1 flex-col gap-4 overflow-y-auto">{children}</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
