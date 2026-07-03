import { SlidersIcon } from './icons'

export function RefineButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex items-center gap-1.5 rounded-md border border-(--form-control-border) px-3 py-1.5 text-sm font-medium text-(--text-form) hover:bg-(--link-hover-bg)"
		>
			<SlidersIcon className="text-(--text-primary)" />
			<span className="hidden min-[1120px]:inline">Refine</span>
		</button>
	)
}
