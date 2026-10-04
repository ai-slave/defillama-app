import * as Ariakit from '@ariakit/react'
import { useId, type ReactNode } from 'react'

/* Tabs — content panels switched by a tab list. The list is a SegmentedControl with `semantics="tabs"` or `Tab`
   elements; each panel is a `TabPanel`, and the ids tie every tab to its panel. */

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
