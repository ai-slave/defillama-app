import type { ComponentPropsWithoutRef, ElementType } from 'react'

export function RiskCallout<T extends ElementType = 'div'>({
	as,
	padding = 'md',
	className,
	...props
}: {
	as?: T
	padding?: 'sm' | 'md'
	className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>) {
	const Component = (as ?? 'div') as ElementType
	return (
		<Component
			className={`rounded-lg border border-warning/30 bg-warning/10 ${padding === 'sm' ? 'p-2' : 'p-3'} ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
