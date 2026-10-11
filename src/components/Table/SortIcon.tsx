import { Icon } from '~/ui/Icon'

export function SortIcon({ dir }: { dir: string | boolean }) {
	return (
		<div className="relative top-px flex w-2.5 shrink-0 flex-col">
			<Icon
				name="sort-up"
				aria-hidden="true"
				className={`relative top-0.5 block size-2.5 shrink-0 ${dir === 'asc' ? 'text-link' : 'text-tertiary'}`}
			/>
			<Icon
				name="sort-down"
				aria-hidden="true"
				className={`relative bottom-0.5 block size-2.5 shrink-0 ${dir === 'desc' ? 'text-link' : 'text-tertiary'}`}
			/>
		</div>
	)
}
