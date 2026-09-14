import { useLayoutEffect, useRef, useState } from 'react'
import { SegmentedControl, type SegmentedControlOption, type TagGroupSize } from '~/ui/SegmentedControl'
import { tw } from '~/ui/tw'

const PRO_SEGMENTED_SIZES: Record<TagGroupSize, string> = {
	sm: tw`py-0.5 text-xs`,
	md: tw`py-1.5 text-sm`
}

const PRO_SEGMENTED_SURFACE = tw`border border-pro-cards-border`

const PRO_SEGMENTED_BUTTON = tw`relative z-10 inline-flex items-center justify-center self-stretch text-pro-text-secondary transition-colors duration-120 ease-out-quart hover:text-pro-text-primary disabled:opacity-50 has-disabled:opacity-50 data-[active=true]:text-pro-info-400 dark:data-[active=true]:text-pro-info-200`

const PRO_SEGMENTED_INDICATOR = tw`pointer-events-none absolute inset-y-0.5 left-0 z-0 rounded-sm bg-pro-info-100 transition-[transform,width] duration-180 ease-out-quart data-[ready=false]:transition-none dark:bg-pro-info-300/20`

type ProSegmentedProps<T extends string> = {
	options: ReadonlyArray<SegmentedControlOption<T>>
	label: string
	size?: TagGroupSize
	className?: string | undefined
} & (
	| { semantics?: 'radio'; value: T | null; onValueChange: (value: T) => void }
	| { semantics: 'tabs'; value?: never; onValueChange?: never }
)

export function ProSegmented<T extends string>(props: ProSegmentedProps<T>) {
	const { options, label, size = 'md', className } = props
	const containerRef = useRef<HTMLDivElement>(null)
	const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean } | null>(null)
	useLayoutEffect(() => {
		const container = containerRef.current
		if (!container) return
		const measure = () => {
			const active = container.querySelector<HTMLElement>('[data-active="true"]')
			if (!active) {
				setIndicator(null)
				return
			}
			const left = active.offsetLeft
			const width = active.offsetWidth
			setIndicator((previous) =>
				previous && previous.left === left && previous.width === width
					? previous
					: { left, width, ready: previous !== null }
			)
		}
		measure()
		const selectionObserver = new MutationObserver(measure)
		selectionObserver.observe(container, { attributes: true, attributeFilter: ['data-active'], subtree: true })
		const sizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
		sizeObserver?.observe(container)
		return () => {
			selectionObserver.disconnect()
			sizeObserver?.disconnect()
		}
	}, [])
	const shared = {
		variant: 'pro' as const,
		size,
		className: PRO_SEGMENTED_SURFACE,
		buttonClassName: `${PRO_SEGMENTED_BUTTON} ${PRO_SEGMENTED_SIZES[size]}`,
		options,
		label
	}
	return (
		<div ref={containerRef} className={`relative isolate w-fit max-w-full ${className ?? ''}`.trim()}>
			<span
				aria-hidden
				data-ready={indicator?.ready ?? false}
				className={PRO_SEGMENTED_INDICATOR}
				style={indicator ? { width: indicator.width, transform: `translateX(${indicator.left}px)` } : { width: 0 }}
			/>
			{props.semantics === 'tabs' ? (
				<SegmentedControl {...shared} semantics="tabs" />
			) : (
				<SegmentedControl {...shared} value={props.value} onValueChange={props.onValueChange} />
			)}
		</div>
	)
}
