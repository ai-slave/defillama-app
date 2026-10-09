import { type ReactNode, type Ref, useRef } from 'react'
import { Button } from './Button'

/* ----------------------------------------------------------------------------
   FileButton — pick files from the device. A Button that opens a hidden file
   input, so a file pick looks, focuses, disables and waits like every other
   button; never style the browser's own file box (`file:` utilities). The
   chosen name, an upload's progress and its error show beside or under it, in
   the caller's own copy. The input is cleared after each pick, so picking the
   same file again after an error or a removal still reports it.
   `ref` reaches the Button, so a form can hand focus back to it after a file
   is removed or an error is dismissed; `accessibleWhenDisabled` keeps it
   focusable when it disables itself at a limit (ten files picked).
---------------------------------------------------------------------------- */

export function FileButton({
	accept,
	multiple = false,
	onFiles,
	size,
	variant,
	pendingLabel,
	pending,
	disabled,
	accessibleWhenDisabled,
	ref,
	className,
	children,
	'data-umami-event': umamiEvent
}: {
	/** The input's `accept` list, e.g. ".csv,text/csv". */
	accept: string
	multiple?: boolean
	/** Called with the picked files; never with an empty list. */
	onFiles: (files: Array<File>) => void
	size: 'sm' | 'md'
	variant?: 'secondary' | 'primary' | 'outline'
	pendingLabel?: string
	pending?: boolean
	disabled?: boolean
	accessibleWhenDisabled?: boolean
	ref?: Ref<HTMLButtonElement>
	/** Layout placement only. */
	className?: string
	children: ReactNode
	'data-umami-event'?: string
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				multiple={multiple}
				hidden
				onChange={(event) => {
					const files = [...(event.currentTarget.files ?? [])]
					event.currentTarget.value = ''
					if (files.length > 0) onFiles(files)
				}}
			/>
			<Button
				type="button"
				size={size}
				variant={variant}
				pendingLabel={pendingLabel}
				pending={pending}
				disabled={disabled}
				accessibleWhenDisabled={accessibleWhenDisabled}
				ref={ref}
				className={className}
				data-umami-event={umamiEvent}
				onClick={() => inputRef.current!.click()}
			>
				{children}
			</Button>
		</>
	)
}
