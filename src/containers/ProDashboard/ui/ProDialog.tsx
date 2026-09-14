import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithoutRef, ComponentPropsWithRef, ReactNode } from 'react'
import { DialogCloseButton, DialogHeading, dialogScrollableBodyStyles } from '~/ui/Dialog'
import { proDialogLg, proDialogMd, proDialogSm } from './styles'

export type ProDialogWidth = 'sm' | 'md' | 'lg'

const PRO_DIALOG_SURFACES: Record<ProDialogWidth, string> = {
	sm: proDialogSm,
	md: proDialogMd,
	lg: proDialogLg
}

type ProDialogProps = {
	width?: ProDialogWidth
	heading?: ReactNode
	leading?: ReactNode
	closeButtonProps?: ComponentPropsWithoutRef<typeof DialogCloseButton>
	bodyClassName?: string
	footer?: ReactNode
	children: ReactNode
} & Omit<ComponentPropsWithRef<typeof Ariakit.Dialog>, 'className' | 'children' | 'title'>

export function ProDialog({
	width = 'sm',
	heading,
	leading,
	closeButtonProps,
	bodyClassName,
	footer,
	children,
	...dialogProps
}: ProDialogProps) {
	return (
		<Ariakit.Dialog portal unmountOnHide className={PRO_DIALOG_SURFACES[width]} {...dialogProps}>
			<div className="flex items-center justify-between gap-3 border-b border-pro-cards-border px-5 py-3">
				{leading || heading ? (
					<div className="flex min-w-0 items-center gap-2">
						{leading}
						{heading ? <DialogHeading className="truncate">{heading}</DialogHeading> : null}
					</div>
				) : (
					<span />
				)}
				<DialogCloseButton {...closeButtonProps} />
			</div>
			<div className={`${dialogScrollableBodyStyles} ${bodyClassName ?? 'px-5 py-4'}`}>{children}</div>
			{footer ? (
				<div className="flex justify-end gap-2 border-t border-pro-cards-border px-5 py-3">{footer}</div>
			) : null}
		</Ariakit.Dialog>
	)
}
