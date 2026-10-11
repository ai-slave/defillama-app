import { Icon, type IIcon } from './Icon'
import { BusyGlyph } from './Status'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   IconTile — an icon in a tinted square that says what a card, row, menu
   item or dialog header is about: a launcher card's dataset, an alert's
   type, a section's subject.

   <IconTile icon="calendar-plus" tone="warning" size="sm" />

   `size` sets the box, its radius and the icon together, so tiles never
   drift: sm (32px, 16px icon) sits beside a heading or a title with one
   meta line; md (40px, 20px icon) leads a launcher or card with a title and
   a description. `tone` is the subject's hue: brand for most subjects,
   warning and error where the subject is a caution or a block, success for
   a done step, neutral for a quiet or inactive one. A tile that follows a
   selection (a menu's current page) switches tone from the caller's state.
   `busy` puts the spinner in the icon's place while the card's own action
   waits; the card keeps `aria-busy` and names the work.

   The tile is decoration: the text beside it names the subject, so it is
   hidden from assistive tech. A round bordered disc is an entity logo
   (`Logo`, ./Logo.tsx), an empty state's disc belongs to `EmptyState`
   (./Status.tsx), and a letter, number or emoji in a box is not an icon.
   Not a control: a button with an icon is `Button square`.
---------------------------------------------------------------------------- */

const TONE = {
	brand: tw`bg-brand-tint text-link`,
	warning: tw`bg-warning-tint text-warning`,
	error: tw`bg-error-tint text-error`,
	success: tw`bg-success-tint text-success`,
	neutral: tw`border border-subtle bg-surface-elevated-1 text-secondary`
} as const

const SIZE = {
	sm: { box: tw`size-8 rounded-lg`, icon: tw`size-4`, spinner: 14 },
	md: { box: tw`size-10 rounded-lg`, icon: tw`size-5`, spinner: 18 }
} as const

export function IconTile({
	icon,
	tone,
	size,
	busy = false
}: {
	icon: IIcon['name']
	tone: keyof typeof TONE
	size: keyof typeof SIZE
	busy?: boolean
}) {
	const s = SIZE[size]
	return (
		<span aria-hidden className={`flex shrink-0 items-center justify-center ${s.box} ${TONE[tone]}`}>
			{busy ? <BusyGlyph decorative size={s.spinner} /> : <Icon name={icon} className={s.icon} />}
		</span>
	)
}
