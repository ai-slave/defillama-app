import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Icon } from '~/ui/Icon'

interface CopyHelperProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	toCopy: string
	size?: number
}

export function CopyHelper({ toCopy, size = 14, ...props }: CopyHelperProps) {
	const [copied, setCopied] = useState(false)
	const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(() => {
		return () => {
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
		}
	}, [])
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(toCopy)
			setCopied(true)
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
			copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy content:', error)
			toast.error('Failed to copy content')
		}
	}
	return (
		<button
			className="flex shrink-0 items-center p-0.5 text-secondary hover:text-primary focus-visible:text-primary"
			onClick={() => {
				void copy()
			}}
			aria-label="Copy"
			{...props}
		>
			{copied ? (
				<Icon name="check-circle" height={size} width={size} />
			) : (
				<Icon name="copy" height={size} width={size} />
			)}
		</button>
	)
}
