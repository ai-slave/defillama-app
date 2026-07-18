import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'

interface FailedDataPopoverProps<T extends string> {
	items: ReadonlyArray<T>
	ariaLabel: string
	getLabel?: (item: T) => ReactNode
	title?: ReactNode
}

export function FailedDataPopover<T extends string>({
	items,
	ariaLabel,
	getLabel,
	title = 'Failed to load data for:'
}: FailedDataPopoverProps<T>) {
	if (items.length === 0) {
		return null
	}

	return (
		<Ariakit.PopoverProvider>
			<Ariakit.PopoverDisclosure className="hover-wash absolute right-2 bottom-2 z-10 flex items-center justify-center rounded-full border border-subtle bg-surface p-1.5 text-data-down">
				<Icon name="alert-triangle" className="size-3.5" />
				<span className="sr-only">{ariaLabel}</span>
			</Ariakit.PopoverDisclosure>
			<Ariakit.Popover
				unmountOnHide
				hideOnInteractOutside
				gutter={6}
				className="z-10 mr-1 flex max-h-[calc(100dvh-80px)] w-[min(calc(100vw-16px),300px)] flex-col overflow-auto overscroll-contain rounded-xl border border-medium bg-overlay body-sm text-primary shadow-overlay-sm"
			>
				<div className="flex flex-col gap-1 p-3">
					<p className="label-sm text-data-down">{title}</p>
					<ul className="pl-4">
						{items.map((item) => (
							<li key={item} className="list-disc">
								{getLabel ? getLabel(item) : item}
							</li>
						))}
					</ul>
				</div>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}
