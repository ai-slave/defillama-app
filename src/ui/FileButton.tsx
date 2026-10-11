import { type ReactNode, useRef } from 'react'
import { Button } from './Button'

/* ----------------------------------------------------------------------------
   FileButton — pick files from the device. A Button that opens a hidden file
   input, so a file pick looks and focuses like every other button; never
   style the browser's own file box (`file:` utilities). The chosen name, an
   upload's progress and its error show beside or under it, in the caller's
   own copy. The input is cleared after each pick, so picking the
   same file again after an error or a removal still reports it.
   A flow where several controls open one picker (an UploadTile beside a
   Replace button, a menu item) keeps its own hidden input (./UploadTile.tsx).
---------------------------------------------------------------------------- */

export function FileButton({
	accept,
	onFiles,
	size,
	className,
	children,
	'data-umami-event': umamiEvent
}: {
	/** The input's `accept` list, e.g. ".csv,text/csv". */
	accept: string
	/** Called with the picked files; never with an empty list. */
	onFiles: (files: Array<File>) => void
	size: 'sm' | 'md'
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
				className={className}
				data-umami-event={umamiEvent}
				onClick={() => inputRef.current!.click()}
			>
				{children}
			</Button>
		</>
	)
}
