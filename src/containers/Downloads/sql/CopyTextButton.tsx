import { useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

/** Copies text and reports the result on the button itself, so the SQL reference sheet never needs a toast. */
export function CopyTextButton({ text, label, disabled = false }: { text: string; label: string; disabled?: boolean }) {
	const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
	return (
		<Button
			type="button"
			size="sm"
			disabled={disabled}
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text)
				} catch {
					setStatus('failed')
					return
				}
				setStatus('copied')
				window.setTimeout(() => setStatus('idle'), 2000)
			}}
		>
			<Icon name={status === 'copied' ? 'check' : 'copy'} className="size-3.5" aria-hidden="true" />
			{status === 'copied' ? 'Copied' : status === 'failed' ? "Couldn't copy" : label}
		</Button>
	)
}
