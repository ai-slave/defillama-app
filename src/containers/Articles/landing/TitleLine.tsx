import clsx from 'clsx'
import React from 'react'

interface TitleLineProps {
	title?: string
	hideOnMobile?: boolean
}

export function TitleLine(props: TitleLineProps) {
	const { title = '', hideOnMobile = false } = props

	return (
		<div className="flex grow items-center gap-x-3.75 text-lg leading-[150%] font-medium text-research-navy">
			<div>{title}</div>
			<div
				className={clsx(
					'grow border-t lg:border-t-[2px]',
					// The rule takes the title's ink.
					'border-current',
					hideOnMobile && 'max-md:hidden'
				)}
			/>
		</div>
	)
}
