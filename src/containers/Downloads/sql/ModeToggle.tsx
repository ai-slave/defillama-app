import { Icon } from '~/components/Icon'

export type DownloadsMode = 'simple' | 'sql'

interface ModeToggleProps {
	mode: DownloadsMode
	onChange: (next: DownloadsMode) => void
	size?: 'sm' | 'md'
}

export function ModeToggle({ mode, onChange, size = 'md' }: ModeToggleProps) {
	return (
		<div
			role="tablist"
			aria-label="Downloads mode"
			className={`inline-flex items-center gap-1 rounded-lg border border-(--legacy-divider) bg-surface ${
				size === 'md' ? 'p-1' : 'p-0.5'
			}`}
		>
			<ModeButton
				active={mode === 'simple'}
				label="Simple"
				icon="download-cloud"
				onClick={() => onChange('simple')}
				size={size}
			/>
			<ModeButton
				active={mode === 'sql'}
				label="SQL Studio"
				icon="code"
				onClick={() => onChange('sql')}
				badge="NEW"
				size={size}
			/>
		</div>
	)
}

function ModeButton({
	active,
	label,
	icon,
	onClick,
	badge,
	size
}: {
	active: boolean
	label: string
	icon: 'download-cloud' | 'code'
	onClick: () => void
	badge?: string
	size: 'sm' | 'md'
}) {
	const sizing = size === 'md' ? 'gap-2 rounded-md px-4 py-2 text-sm' : 'gap-1.5 rounded-sm px-2.5 py-1 text-xs'
	const iconSize = size === 'md' ? 'size-4' : 'size-3'
	return (
		<button
			role="tab"
			type="button"
			aria-selected={active}
			onClick={onClick}
			className={`flex items-center font-medium transition-colors ${sizing} ${
				active
					? 'bg-(--legacy-primary) text-white shadow-sm'
					: 'text-(--legacy-text-secondary) hover:bg-hover-row hover:text-(--legacy-text-primary)'
			}`}
		>
			<Icon name={icon} className={iconSize} />
			{label}
			{badge ? (
				<span
					className={`rounded-sm px-1.5 py-px text-[10px] font-bold tracking-wider ${
						active ? 'bg-white/25 text-white' : 'bg-pro-green-200/15 text-pro-green-300'
					}`}
				>
					{badge}
				</span>
			) : null}
		</button>
	)
}
