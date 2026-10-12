import * as Ariakit from '@ariakit/react'
import clsx from 'clsx'
import { type ComponentPropsWithRef, type ElementType, type ReactNode, type Ref, useId } from 'react'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Tabs — content panels switched by a tab list, the underline tab look,
   and which tab look goes where.

   Panels: the list is a SegmentedControl with `semantics="tabs"` or `Tab`
   elements; each panel is a `TabPanel`, and the ids tie every tab to its
   panel.

   Two looks, picked by where the tabs sit:
   - Underline (`TabLink`): tabs that head a page section. Route navigation
     between pages (`TabNav`), and full-width panel tabs over a page section
     (`UnderlineTabList`).
   - Segmented (`SegmentedControl semantics="tabs"`): panel tabs that belong
     to a card, panel, dialog or toolbar header.
   A value picker is never drawn as tabs; it is a radio `SegmentedControl`.
   Underline panel tabs with plain text labels pass `tabs` to
   `UnderlineTabList`; it takes `Tab` children rendered as `TabLink` buttons
   only when the items carry icons or counts or need per-tab props (an
   analytics event, a ref, a width).

   Item: label-md, px-3 py-2, inactive text-secondary (primary on hover),
   active = text-primary + 2px bg-brand underline bar with rounded top
   corners, inset 4px from the edges. An icon before the label or a count
   after it sits 6px away, laid out by the item itself; a tab wider than its
   content (`flex-1` on a phone) centers it.

   Panel: `TabPanel` draws nothing, so it is the content's region: its
   `className` sets the content's layout and inset (a dialog body's p-4, a
   scrolling sidebar's p-3). A page section's panel directly under an
   underline track starts 12px below it (`pt-3`).

   Track: the subtle bottom border the items sit on, scrolling sideways when
   they overflow, with no scrollbar, like the app's other sideways strips
   (a trackpad, touch, or focus moving to a tab scrolls it). `TabNav` draws it
   for route navigation and `UnderlineTabList` for panel tabs; pages never
   draw it themselves. Their `className` places it or sets its display (a
   nav hidden below a breakpoint): `flex` is an `initial:` default.
   `UnderlineTabList` passes `ref` to the track, for a caller that measures
   its overflow to show scroll arrows over it (a Pro dashboard's sections).

   Rail: a vertical list of panel tabs (a settings dialog's sections, a
   sidebar of categories) is an Ariakit `TabList` with `RailItem` tabs. The
   rails differ in everything around the list (a phone strip, a bordered
   sidebar, group headings), so they share RailItem, not a list part;
   raw-tab-list lists each one. A rail that drifts from the others, or a
   fifth one, is the time to add the part.

   Route navigation: `TabNav` is the labeled `<nav>`, and the current
   page's item carries `aria-current="page"`, which also draws it active:
   <TabNav label="…"> <TabLink href … aria-current={…}> </TabNav>
   A nav holds TabLinks, links or buttons, and may lead with a control that
   switches what the tabs belong to (a protocol picker).
   Panel tabs get `data-active` from `Tab` instead.
---------------------------------------------------------------------------- */

const tabTrackStyles = tw`scrollbar-none w-full flex-nowrap overflow-x-auto border-b border-subtle initial:flex`

/** Route tabs: the labeled nav and its track. `className` is placement and display only. */
export function TabNav({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
	return (
		<nav aria-label={label} className={clsx(tabTrackStyles, className)}>
			{children}
		</nav>
	)
}

/** One underline panel tab: the value of its panel and a plain text label. */
export type UnderlineTab<T extends string> = { id: T; label: string }

/** Panel tabs on the underline track, inside a `Tabs` provider. Plain text labels pass `tabs`; items with icons, counts
    or per-tab props are `Tab` children rendered as `TabLink` buttons. `className` is placement and display only; `ref`
    reaches the track. */
export function UnderlineTabList({
	label,
	className,
	ref,
	...items
}: { label: string; className?: string; ref?: Ref<HTMLDivElement> } & (
	| { tabs: ReadonlyArray<UnderlineTab<string>> }
	| { children: ReactNode }
)) {
	return (
		<Ariakit.TabList ref={ref} aria-label={label} className={clsx(tabTrackStyles, className)}>
			{'tabs' in items
				? items.tabs.map((tab) => (
						<Tab key={tab.id} value={tab.id} render={<TabLink as="button" type="button" />}>
							{tab.label}
						</Tab>
					))
				: items.children}
		</Ariakit.TabList>
	)
}

type TabLinkProps<T extends ElementType> = {
	as?: T
	/** Placement only (policy: check-part-classes). */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function TabLink<T extends ElementType = 'a'>({ as, className, ...props }: TabLinkProps<T>) {
	const Component = (as ?? 'a') as ElementType
	return (
		<Component
			className={`relative flex shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3 py-2 label-md whitespace-nowrap text-secondary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:rounded-t-xs after:bg-brand after:opacity-0 hover:text-primary focus-visible:text-primary aria-[current=page]:text-primary aria-[current=page]:after:opacity-100 data-[active=true]:text-primary data-[active=true]:after:opacity-100 ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

export function tabIds(prefix: string, value: string) {
	return { tabId: `${prefix}-tab-${value}`, panelId: `${prefix}-panel-${value}` }
}

/** Keep selection in the caller; route-driven views require explicit activation by default. */
export function Tabs<T extends string>({
	value,
	onValueChange,
	values,
	id,
	selectOnMove = false,
	orientation,
	children
}: {
	value: T
	onValueChange: (value: T) => void
	values: ReadonlyArray<T>
	id?: string
	selectOnMove?: boolean
	orientation?: Ariakit.TabProviderProps['orientation']
	children: ReactNode
}) {
	const generatedId = useId()
	const prefix = id ?? generatedId
	return (
		<Ariakit.TabProvider
			id={prefix}
			selectedId={tabIds(prefix, value).tabId}
			setSelectedId={(selectedId) => {
				const next = values.find((item) => tabIds(prefix, item).tabId === selectedId)
				if (next !== undefined && next !== value) onValueChange(next)
			}}
			selectOnMove={selectOnMove}
			orientation={orientation}
		>
			{children}
		</Ariakit.TabProvider>
	)
}

export function Tab({ value, ...props }: Omit<Ariakit.TabProps, 'id'> & { value: string }) {
	const store = Ariakit.useTabContext()!
	const prefix = Ariakit.useStoreState(store, 'id')
	const { tabId } = tabIds(prefix, value)
	const selected = Ariakit.useStoreState(store, (state) => state.selectedId === tabId)
	return <Ariakit.Tab accessibleWhenDisabled={false} id={tabId} data-active={selected} {...props} />
}

/** Mounting policy stays explicit at each caller: hidden panels remain mounted by default. */
export function TabPanel({ value, ...props }: Omit<Ariakit.TabPanelProps, 'tabId'> & { value: string }) {
	const store = Ariakit.useTabContext()!
	const prefix = Ariakit.useStoreState(store, 'id')
	const { tabId, panelId } = tabIds(prefix, value)
	return <Ariakit.TabPanel id={panelId} tabId={tabId} {...props} />
}
