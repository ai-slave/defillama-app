import { useState } from 'react'
import { DialogBody, DialogHeader, DialogToolbar, SideSheet } from '~/ui/Dialog'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { CookbookTab, ShortcutsTab } from './DocsPanel'
import { SchemaBrowser, type SchemaBrowserProps } from './SchemaBrowser'

interface SchemaDrawerProps extends SchemaBrowserProps {
	open: boolean
	onClose: () => void
	onApplyAndRun: (sql: string) => void
}

const TABS = [
	{ value: 'schema', label: 'Schema' },
	{ value: 'cookbook', label: 'Cookbook' },
	{ value: 'shortcuts', label: 'Shortcuts' }
] as const
type TabId = (typeof TABS)[number]['value']

const DESCRIPTIONS: Record<TabId, string> = {
	schema: 'Every table you can query with LlamaSQL.',
	cookbook: 'LlamaSQL recipes for DefiLlama tables.',
	shortcuts: 'Editor keybindings and LlamaSQL dialect tips.'
}

export function SchemaDrawer({ open, onClose, onReplaceSql, onApplyAndRun, ...browserProps }: SchemaDrawerProps) {
	const [tab, setTab] = useState<TabId>('schema')

	return (
		<SideSheet open={open} onClose={onClose} size="md" portal unmountOnHide>
			<DialogHeader title="SQL reference" subtitle={DESCRIPTIONS[tab]} />
			<Tabs<TabId> value={tab} onValueChange={setTab} values={TABS.map((item) => item.value)}>
				<DialogToolbar>
					<SegmentedControl semantics="tabs" label="SQL reference section" variant="field" size="md" options={TABS} />
				</DialogToolbar>
				<DialogBody>
					<TabPanel value={tab}>
						{tab === 'schema' ? (
							<SchemaBrowser
								{...browserProps}
								onReplaceSql={(snippet) => {
									onReplaceSql(snippet)
									onClose()
								}}
							/>
						) : tab === 'cookbook' ? (
							<CookbookTab
								onApplyAndRun={(sql) => {
									onClose()
									onApplyAndRun(sql)
								}}
							/>
						) : (
							<ShortcutsTab />
						)}
					</TabPanel>
				</DialogBody>
			</Tabs>
		</SideSheet>
	)
}
