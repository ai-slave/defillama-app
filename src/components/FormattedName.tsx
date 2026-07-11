import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
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
	// Keep the tooltip anchor mounted before and after measurement. Changing the
	// wrapper changes the available width and can make truncation oscillate.
	const nodeRef = useRef<HTMLSpanElement | null>(null)
	const [isTruncated, setIsTruncated] = useState(false)
	const measure = useCallback((node: HTMLSpanElement) => {
		setIsTruncated(node.scrollWidth > node.clientWidth)
	}, [])
	const setNode = useCallback(
		(node: HTMLSpanElement | null) => {
			if (!node) return
			nodeRef.current = node
			measure(node)
			if (typeof ResizeObserver === 'undefined') return
			const observer = new ResizeObserver(() => measure(node))
			observer.observe(node)
			return () => {
				observer.disconnect()
				if (nodeRef.current === node) nodeRef.current = null
			}
		},
		[measure]
	)

	useEffect(() => {
		if (nodeRef.current) measure(nodeRef.current)
	}, [measure, text])

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

	return (
		<Tooltip content={text} disabled={!isTruncated}>
			{content}
		</Tooltip>
	)
}
