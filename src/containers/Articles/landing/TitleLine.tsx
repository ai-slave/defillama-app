import clsx from 'clsx'
import React from 'react'

interface TitleLineProps {
	title?: string
	hideOnMobile?: boolean
}

export const TitleLine: React.FC<TitleLineProps> = (props) => {
	const { title = '', hideOnMobile = false } = props

	return (
		<div className="flex grow items-center gap-x-3.75 text-lg leading-[150%] font-medium text-research-navy-soft dark:text-research-ink">
			<div>{title}</div>
			<div
				className={clsx(
					'grow border-t lg:border-t-[2px]',
					'border-research-navy-soft dark:border-research-contrast',
					hideOnMobile && 'max-md:hidden'
				)}
			/>
		</div>
	)
}
