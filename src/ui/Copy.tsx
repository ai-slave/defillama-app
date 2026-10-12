import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Icon } from '~/ui/Icon'

interface CopyHelperProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	toCopy: string
	size?: `size-${number}`
}

/** Copies text and says so for 2 seconds; a failed write says so in a toast. A failure opens no fallback dialog with
    the text to select by hand: the write fails only where the browser denies the clipboard, which is rare enough that
    the toast is the whole answer. */
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
			toast.error("Couldn't copy to the clipboard. Try again.")
		}
	}
	return { copied, copy }
}

export function CopyHelper({ toCopy, size = 'size-3.5', className, ...props }: CopyHelperProps) {
	const { copied, copy } = useCopy()
	// The icon swap is silent, so a polite status says the copy landed. It sits beside the button because the
	// button's aria-label replaces anything inside it.
	return (
		<>
			<button
				type="button"
				className={`flex shrink-0 items-center p-0.5 text-secondary hover:text-primary focus-visible:text-primary ${className ?? ''}`.trim()}
				onClick={() => {
					void copy(toCopy)
				}}
				aria-label="Copy"
				{...props}
			>
				{copied ? <Icon name="check-circle" className={size} /> : <Icon name="copy" className={size} />}
			</button>
			<span role="status" className="sr-only">
				{copied ? 'Copied' : ''}
			</span>
		</>
	)
}
