import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef, ElementType } from 'react'
import { Icon, type IIcon } from './Icon'
import { LoadingSpinner } from './internal/Loaders'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   UploadTile — the dashed drop target that picks a file (cover image, avatar,
   PDF, project files), and ImageReplaceTile, its filled twin that shows the
   current image and reveals Replace on hover. DashedTile is the same dashed
   edge on a tile that stands where the next card would: a grid's "Add card",
   a shelf's "View all".

   UploadTile: dashed border-medium on bg-page, text-tertiary icon and label;
   hover and focus darken the border to border-strong and the text to
   primary (a neutral control never hovers blue); the pressed wash while held.
   While a file uploads, set `pending` with its `pendingLabel` ("Uploading…"): the icon becomes
   a spinner, the label reads the pending label, and the tile is announced as
   busy and ignores presses without losing focus. Disabled takes the disabled
   border and text.

   A required pick that is missing takes `aria-invalid`: the border turns
   border-error, with the error text wired through `aria-describedby`.

   ImageReplaceTile: the image fills the tile; hover, focus and a pending
   upload lay the media scrim over it with "Replace" or the pending label.

   `shape`: wide (full width, 112px tall), cover (full width at the 7:4 cover
   ratio), round (a 96px avatar circle).
   The hidden file input stays with the caller, one per flow: the tile, a
   Replace button and a menu item often open the same picker, and a menu
   item unmounts before its input reports the pick. These tiles are the
   visible control that opens it; a lone plain button is FileButton.

   DashedTile: the dashed edge with a label-md text-secondary row (an icon
   beside the label) and no fill of its own, so it shows whatever surface
   holds it (the page, a panel), sized by the caller's
   grid or rail (`className`: span, width, min height). A button by default;
   `as={BasicLink}` with `href` when it opens a page.
---------------------------------------------------------------------------- */

// The dashed edge both tiles share: a neutral control never hovers blue, so hover and focus darken it instead.
const dashedEdgeStyles = tw`border border-dashed border-medium not-aria-disabled:hover:border-strong not-aria-disabled:hover:text-primary focus-visible:border-strong focus-visible:text-primary not-aria-disabled:active:bg-pressed-row`

const SHAPE = {
	wide: 'h-28 w-full rounded-lg',
	cover: 'aspect-[7/4] w-full rounded-lg',
	round: 'size-24 shrink-0 rounded-full'
} as const

type Shape = keyof typeof SHAPE

type TileProps = {
	shape: Shape
	/** The label shown while `pending` ("Uploading…"). */
	pendingLabel?: string
	/** Set while the upload runs. */
	pending?: boolean
	/** Layout placement only. */
	className?: string
} & Omit<ComponentPropsWithRef<typeof Ariakit.Button>, 'className' | 'children'>

export function UploadTile({
	shape,
	icon,
	label,
	hint,
	pendingLabel,
	pending = false,
	disabled,
	className,
	...props
}: TileProps & { icon: IIcon['name']; label: string; hint?: string }) {
	return (
		<Ariakit.Button
			type="button"
			{...props}
			disabled={disabled || pending}
			accessibleWhenDisabled
			aria-busy={pending || undefined}
			className={`flex flex-col items-center justify-center gap-1.5 bg-page p-3 text-center text-tertiary ${dashedEdgeStyles} aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:border-disabled aria-disabled:not-aria-busy:text-disabled aria-invalid:border-error ${SHAPE[shape]} ${className ?? ''}`.trim()}
		>
			{pending ? <LoadingSpinner size={14} /> : <Icon name={icon} className="size-5" />}
			<span className="label-sm">{pending ? pendingLabel : label}</span>
			{hint && !pending ? <span className="body-xs">{hint}</span> : null}
		</Ariakit.Button>
	)
}

export function ImageReplaceTile({
	shape,
	src,
	pendingLabel,
	pending = false,
	disabled,
	className,
	...props
}: TileProps & { src: string }) {
	return (
		<Ariakit.Button
			type="button"
			{...props}
			disabled={disabled || pending}
			accessibleWhenDisabled
			aria-busy={pending || undefined}
			className={`group relative overflow-hidden border border-medium not-aria-disabled:hover:border-strong aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-60 aria-invalid:border-error ${SHAPE[shape]} ${className ?? ''}`.trim()}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={src} alt="" className="size-full object-cover" />
			<span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-media-control label-sm text-media-control opacity-0 group-not-aria-disabled:group-hover:opacity-100 group-not-aria-disabled:group-focus-visible:opacity-100 group-aria-busy:opacity-100">
				{pending ? pendingLabel : 'Replace'}
			</span>
		</Ariakit.Button>
	)
}

type DashedTileProps<T extends ElementType> = {
	as?: T
	/** Layout placement only: grid span, width, min height. */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function DashedTile<T extends ElementType = 'button'>({ as, className, ...props }: DashedTileProps<T>) {
	const Component = (as ?? 'button') as ElementType
	return (
		<Component
			{...(as ? {} : { type: 'button' })}
			className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg label-md text-secondary ${dashedEdgeStyles} ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
