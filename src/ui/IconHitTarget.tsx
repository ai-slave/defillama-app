import type { ComponentPropsWithoutRef, ElementType } from 'react'

export const iconHitTargetStyles =
	'-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full p-1 text-primary hover:bg-hover-row focus-visible:bg-hover-row'

export const tableIconHitTargetStyles = iconHitTargetStyles

type IconHitTargetProps<T extends ElementType> = {
	as?: T
	className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function IconHitTarget<T extends ElementType = 'button'>({ as, className, ...props }: IconHitTargetProps<T>) {
	const Component = (as ?? 'button') as ElementType
	return <Component className={`${iconHitTargetStyles} ${className ?? ''}`.trim()} {...props} />
}
