import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Icon } from '~/ui/Icon'

interface CopyHelperProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	toCopy: string
	size?: number
}

/** Copies text and says so for 2 seconds; a failed write says why in a toast. */
export function useCopy() {
	const [copied, setCopied] = useState(false)
	const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(() => {
		return () => {
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
		}
	}, [])
	const copy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
			copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy content:', error)
			toast.error('Failed to copy content')
		}
	}
	return { copied, copy }
}

export function CopyHelper({ toCopy, size = 14, ...props }: CopyHelperProps) {
	const { copied, copy } = useCopy()
	return (
		<button
			type="button"
			className="flex shrink-0 items-center p-0.5 text-secondary hover:text-primary focus-visible:text-primary"
			onClick={() => {
				void copy(toCopy)
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
