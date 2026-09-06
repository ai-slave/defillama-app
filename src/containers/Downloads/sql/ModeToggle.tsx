import { TabList } from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import { Tab } from '~/ui/Tabs'

export type DownloadsMode = 'simple' | 'sql'

interface ModeToggleProps {
	mode: DownloadsMode
	size?: 'sm' | 'md'
}

export function ModeToggle({ mode, size = 'md' }: ModeToggleProps) {
	return (
		<TabList
			aria-label="Downloads mode"
			className={`inline-flex items-center gap-1 rounded-lg border border-subtle bg-surface ${
				size === 'md' ? 'p-1' : 'p-0.5'
			}`}
		>
			<ModeButton active={mode === 'simple'} label="Simple" icon="download-cloud" value="simple" size={size} />
			<ModeButton active={mode === 'sql'} label="SQL Studio" icon="code" value="sql" badge="NEW" size={size} />
		</TabList>
	)
}

function ModeButton({
	active,
	label,
	icon,
	value,
	badge,
	size
}: {
	active: boolean
	label: string
	icon: 'download-cloud' | 'code'
	value: DownloadsMode
	badge?: string
	size: 'sm' | 'md'
}) {
	const sizing = size === 'md' ? 'gap-2 rounded-md px-4 py-2 text-sm' : 'gap-1.5 rounded-sm px-2.5 py-1 text-xs'
	const iconSize = size === 'md' ? 'size-4' : 'size-3'
	return (
		<Tab
			value={value}
			type="button"
			className={`flex items-center font-medium transition-colors ${sizing} ${
				active
					? 'bg-brand text-on-brand shadow-sm'
					: 'text-pro-text-secondary hover:bg-hover-row hover:text-pro-text-primary'
			}`}
		>
			<Icon name={icon} className={iconSize} />
			{label}
			{badge ? (
				<span
					className={`rounded-sm px-1.5 py-px text-[10px] font-bold tracking-wider ${
						active ? 'bg-white/25 text-on-brand' : 'bg-pro-success-200/15 text-pro-success-300'
					}`}
				>
					{badge}
				</span>
			) : null}
		</Tab>
	)
}
