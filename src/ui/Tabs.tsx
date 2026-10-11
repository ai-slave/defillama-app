import * as Ariakit from '@ariakit/react'
import { type ComponentPropsWithRef, type ElementType, type ReactNode, useId } from 'react'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Tabs — content panels switched by a tab list, the underline tab look,
   and which tab look goes where.

   Panels: the list is a SegmentedControl with `semantics="tabs"` or `Tab`
   elements; each panel is a `TabPanel`, and the ids tie every tab to its
   panel.

   Two looks, picked by where the tabs sit:
   - Underline (`TabLink`): tabs that head a page section. Route navigation
     between pages, and full-width panel tabs over a page section
     (`ViewTabs`, or `Tab` with `render={<TabLink as="button" />}`).
   - Segmented (`SegmentedControl semantics="tabs"`): panel tabs that belong
     to a card, panel, dialog or toolbar header.
   A value picker is never drawn as tabs; it is a radio `SegmentedControl`.
   Underline panel tabs are `ViewTabs`; render `Tab` with `TabLink` by hand
   only when the items carry icons or counts, need per-tab props (an
   analytics event, a ref) or sit on their own track.

   Item: label-md, px-3 py-2, inactive text-secondary (primary on hover),
   active = text-primary + 2px bg-brand underline bar with rounded top
   corners, inset 4px from the edges.

   Route navigation: a `<nav aria-label>` draws the track, and the current
   page's item carries `aria-current="page"`, which also draws it active:
   <nav className={tabTrackStyles} aria-label="…"> <TabLink href … aria-current={…}> </nav>
   Panel tabs get `data-active` from `Tab` instead.
---------------------------------------------------------------------------- */

export const tabTrackStyles = tw`flex w-full flex-nowrap overflow-x-auto border-b border-subtle`

type TabLinkProps<T extends ElementType> = {
	as?: T
	/** Layout placement only — never colors or spacing. */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function TabLink<T extends ElementType = 'a'>({ as, className, ...props }: TabLinkProps<T>) {
	const Component = (as ?? 'a') as ElementType
	return (
		<Component
			className={`relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-secondary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:rounded-t-xs after:bg-brand after:opacity-0 hover:text-primary focus-visible:text-primary aria-[current=page]:text-primary aria-[current=page]:after:opacity-100 data-[active=true]:text-primary data-[active=true]:after:opacity-100 ${className ?? ''}`.trim()}
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
