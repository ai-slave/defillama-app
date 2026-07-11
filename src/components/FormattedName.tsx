import type { CSSProperties } from 'react'
import { Tooltip } from '~/ui/Tooltip'

interface WrapperProps {
	fontSize?: string | number
	fontWeight?: number
	maxCharacters?: number
	link?: boolean
}

interface IFormattedNameProps extends WrapperProps {
	text: string
}

export const FormattedName = ({ text, maxCharacters, fontSize, fontWeight = 400, link }: IFormattedNameProps) => {
	if (!text) {
		return null
	}

	const textStyle: CSSProperties & Record<'--text-size' | '--weight', string | number> = {
		'--text-size': fontSize ?? 'inherit',
		'--weight': fontWeight
	}
	const hasTooltip = typeof maxCharacters === 'number' && text.length > maxCharacters
	const content = (
		<span
			data-link={link ?? false}
			style={textStyle}
			className={`${hasTooltip ? 'cursor-pointer ' : ''}overflow-hidden font-(--weight) text-ellipsis whitespace-nowrap text-(--text-size) data-[link=true]:text-(--legacy-blue)`}
		>
			{text}
		</span>
	)

	return hasTooltip ? <Tooltip content={text}>{content}</Tooltip> : content
}
