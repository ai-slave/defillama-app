import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'

/**
 * One line of status in the conversation, attached to the message it is about: under a failed prompt it sits at
 * the end, under an answer at the start. It is never a tinted box; an action beside it is a small button.
 */
export function ChatStatusLine({
	variant,
	align,
	action,
	children
}: {
	variant: 'error' | 'progress'
	align: 'start' | 'end'
	action?: ReactNode
	children: ReactNode
}) {
	return (
		<div
			role={variant === 'error' ? 'alert' : 'status'}
			aria-live={variant === 'progress' ? 'polite' : undefined}
			className={`flex flex-wrap items-center gap-x-3 gap-y-1 body-sm ${align === 'end' ? 'justify-end text-right' : ''}`}
		>
			<span
				className={`flex min-w-0 items-center gap-1.5 ${variant === 'error' ? 'text-data-down' : 'text-secondary'}`}
			>
				{variant === 'error' ? (
					<Icon name="alert-triangle" className="size-3.5 shrink-0" />
				) : (
					<LoadingSpinner size={14} />
				)}
				<span className="min-w-0">{children}</span>
			</span>
			{action}
		</div>
	)
}
