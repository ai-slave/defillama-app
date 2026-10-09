import type { ComponentPropsWithRef } from 'react'

/* ----------------------------------------------------------------------------
   ComposerFrame — the box around every LlamaAI prompt: the chat composer, a
   project's new-chat composer and the /ai landing's freeform question.

   A composer is a field that holds buttons (attach, mode, send), so it keeps
   the Input recipe's box (8px radius, border-medium, bg-page with the fill
   clipped inside the border, border-strong on hover) and adds only the
   padding its buttons need:
   - row:   one line of text beside 32px buttons, 6px around them (44px tall).
   - stack: the chat composer, a growing textarea over its toolbar.
   The border turns brand while the prompt's own text control has focus;
   tabbing to the attach or mode buttons leaves it alone, so the box marks
   where typing goes. `gold` is the /ai landing's: its focus border and glow
   come from the gold welcome palette, and it takes the card fill, because it
   sits on the page beside surface cards, where a page fill reads as disabled.
   The chat composers sit inside a surface panel and keep the field's page fill. A ComposerTray above the chat
   composer squares the corners they share.

   `className` is layout placement only, like every recipe.
---------------------------------------------------------------------------- */

const FRAME =
	'rounded-lg border border-medium bg-clip-padding not-has-[textarea:focus,input:focus]:hover:border-strong [[data-composer-tray]+&]:rounded-t-none'

const LAYOUT = {
	row: 'flex items-end gap-2 p-1.5',
	stack: 'flex flex-col gap-4 p-4'
} as const

const TONE = {
	default: 'bg-page has-[textarea:focus,input:focus]:border-brand',
	gold: 'bg-surface has-[textarea:focus,input:focus]:border-ai-gold-deep has-[textarea:focus,input:focus]:shadow-ai-focus-gold dark:has-[textarea:focus,input:focus]:shadow-ai-focus-gold-dark'
} as const

type FrameLook = {
	layout: keyof typeof LAYOUT
	tone?: keyof typeof TONE
	/** Layout placement only. */
	className?: string
}

type ComposerFrameProps = FrameLook &
	(
		| ({ as: 'form' } & Omit<ComponentPropsWithRef<'form'>, 'className'>)
		| ({ as?: 'div' } & Omit<ComponentPropsWithRef<'div'>, 'className'>)
	)

export function ComposerFrame({ layout, tone = 'default', className, as, ...props }: ComposerFrameProps) {
	const classes = `${FRAME} ${LAYOUT[layout]} ${TONE[tone]} ${className ?? ''}`.trim()
	// A composer never shows the browser's validation bubble; an empty prompt is a disabled send, not an error.
	if (as === 'form') return <form noValidate className={classes} {...(props as ComponentPropsWithRef<'form'>)} />
	return <div className={classes} {...(props as ComponentPropsWithRef<'div'>)} />
}
