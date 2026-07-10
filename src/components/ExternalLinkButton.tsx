import type { ComponentPropsWithRef } from 'react'
import { Icon, type IIcon } from '~/components/Icon'
import { buttonStyles } from '~/ui/Button'

/* ----------------------------------------------------------------------------
   ExternalLinkButton — the app-wide grammar for external link pills
   (protocol page "Protocol Information" row): optional brand icon on the
   left, label in the middle, arrow-up-right affordance on the right, all on
   the secondary md button recipe.

   Multi-URL cases (several websites, audit reports…) are not this
   component's job — use <Menu isExternal className={buttonStyles({ size: 'md' })}>.
---------------------------------------------------------------------------- */

interface ExternalLinkButtonProps extends Omit<ComponentPropsWithRef<'a'>, 'className'> {
	/** Brand icon shown before the label (globe, github, twitter, …). */
	icon?: IIcon['name']
	/** Layout placement only (ml-auto, w-full, …) — never colors or spacing. */
	className?: string
}

export function ExternalLinkButton({ icon, className, children, ...props }: ExternalLinkButtonProps) {
	return (
		<a
			className={`${buttonStyles({ size: 'md' })} ${className ?? ''}`.trim()}
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		>
			{icon ? <Icon name={icon} className="size-3.5 shrink-0" /> : null}
			<span>{children}</span>
			<Icon name="arrow-up-right" className="size-3.5 shrink-0" />
		</a>
	)
}
