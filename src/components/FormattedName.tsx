import { type CSSProperties, useEffect, useState } from 'react'
import { Tooltip } from '~/ui/Tooltip'

interface WrapperProps {
	fontSize?: string | number
	fontWeight?: number
	/** @deprecated the tooltip now appears automatically whenever the text is visually truncated */
	maxCharacters?: number
	link?: boolean
}

interface IFormattedNameProps extends WrapperProps {
	text: string
}

export const FormattedName = ({ text, fontSize, fontWeight = 400, link }: IFormattedNameProps) => {
	// Tooltip eligibility comes from real overflow, not a character count: the
	// span is ellipsized by CSS, so scrollWidth > clientWidth is the truth.
	// SSR and first paint render the bare span (no tooltip) so hydration is
	// deterministic; the effect measures after mount and on container resizes.
	const [node, setNode] = useState<HTMLSpanElement | null>(null)
	const [isTruncated, setIsTruncated] = useState(false)

	useEffect(() => {
		if (!node) return
		const measure = () => setIsTruncated(node.scrollWidth > node.clientWidth)
		measure()
		if (typeof ResizeObserver === 'undefined') return
		const observer = new ResizeObserver(measure)
		observer.observe(node)
		return () => observer.disconnect()
	}, [node, text])

	if (!text) {
		return null
	}

	const textStyle: CSSProperties & Record<'--text-size' | '--weight', string | number> = {
		'--text-size': fontSize ?? 'inherit',
		'--weight': fontWeight
	}

	const content = (
		<span
			ref={setNode}
			data-link={link ?? false}
			style={textStyle}
			className={`${isTruncated ? 'cursor-pointer ' : ''}overflow-hidden font-(--weight) text-ellipsis whitespace-nowrap text-(--text-size) data-[link=true]:text-(--legacy-blue)`}
		>
			{text}
		</span>
	)

	return isTruncated ? <Tooltip content={text}>{content}</Tooltip> : content
}
