import type { ComponentPropsWithRef, ElementType } from 'react'

/* DashedTile — a dashed tile that adds or reveals more in place of a card: the dashboard's "Add card" and a
   following shelf's "View all". It takes UploadTile's border recipe (dashed border-medium that darkens to
   border-strong with the label on hover and focus, the pressed wash while held), because a neutral control
   never hovers blue. `className` is layout only (grid span, width, height). */

type DashedTileProps<T extends ElementType> = {
	as?: T
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function DashedTile<T extends ElementType = 'button'>({ as, className, ...props }: DashedTileProps<T>) {
	const Component = (as ?? 'button') as ElementType
	return (
		<Component
			{...(as ? {} : { type: 'button' })}
			className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-medium label-md text-secondary hover:border-strong hover:text-primary focus-visible:border-strong focus-visible:text-primary active:bg-pressed-row ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
