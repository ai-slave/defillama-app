import type { ReactNode } from 'react'

export function ProMeta({ items, className }: { items: Array<ReactNode>; className?: string | undefined }) {
	const visible = items.filter((item) => item !== null && item !== undefined && item !== false && item !== '')
	if (visible.length === 0) return null
	let separated: ReactNode = visible[0]
	for (let index = 1; index < visible.length; index++) {
		separated = (
			<>
				{separated}
				<span aria-hidden="true">·</span>
				{visible[index]}
			</>
		)
	}
	return (
		<span className={`flex flex-wrap items-center gap-x-1.5 body-sm text-pro-text-tertiary ${className ?? ''}`.trim()}>
			{separated}
		</span>
	)
}
