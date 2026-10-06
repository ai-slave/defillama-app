import type { ComponentPropsWithRef } from 'react'
import { Button } from '~/ui/Button'
import { Icon, type IIcon } from '~/ui/Icon'

/* ----------------------------------------------------------------------------
   ExternalLinkButton — every external link presented as a button: an
   optional 14px brand icon on the left (globe, github, twitter, …), the
   label, and a 14px arrow-up-right on the right, all on the secondary md
   button recipe. Never hand-roll an icon + label + arrow anchor.

   Multi-URL cases (several websites, audit reports) use
   <Menu isExternal> instead.
---------------------------------------------------------------------------- */

interface ExternalLinkButtonProps extends Omit<ComponentPropsWithRef<'a'>, 'className'> {
	/** Brand icon shown before the label (globe, github, twitter, …). */
	icon?: IIcon['name']
	/** Layout placement only (ml-auto, w-full, …) — never colors or spacing. */
	className?: string
}

export function ExternalLinkButton({ icon, className, children, ...props }: ExternalLinkButtonProps) {
	return (
		<Button as="a" size="md" className={className} target="_blank" rel="noopener noreferrer" {...props}>
			{icon ? <Icon name={icon} className="size-3.5 shrink-0" /> : null}
			<span>{children}</span>
			<Icon name="arrow-up-right" className="size-3.5 shrink-0" />
		</Button>
	)
}
