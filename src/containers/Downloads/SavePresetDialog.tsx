import * as Ariakit from '@ariakit/react'
import { useMemo, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'

interface Props {
	suggestedName: string
	existingNames: Array<string>
	onSave: (name: string, replaceExisting: boolean) => void
	onClose: () => void
	title?: string
	description?: string
	submitLabel?: string
	replaceLabel?: string
	placeholder?: string
}

export function SavePresetDialog({
	suggestedName,
	existingNames,
	onSave,
	onClose,
	title = 'Save preset',
	description = 'Saved presets let you re-run this download with the same columns and filters.',
	submitLabel = 'Save',
	replaceLabel = 'Replace',
	placeholder = 'e.g. Aave fees — weekly'
}: Props) {
	const nameRef = useRef<HTMLInputElement>(null)
	const [name, setName] = useState(suggestedName)

	const existingSet = useMemo(() => {
		const s = new Set<string>()
		for (const n of existingNames) s.add(n.trim().toLowerCase())
		return s
	}, [existingNames])

	const trimmed = name.trim()
	const isEmpty = trimmed.length === 0
	const isDuplicate = !isEmpty && existingSet.has(trimmed.toLowerCase())

	return (
		<Ariakit.DialogProvider
			open
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<Ariakit.Dialog
				initialFocus={nameRef}
				className="fixed inset-0 z-60 m-auto flex h-fit w-[calc(100vw-2rem)] max-w-md flex-col gap-4 rounded-xl border border-subtle bg-surface p-5 shadow-2xl"
				portal
				unmountOnHide
				backdrop={<div className="fixed inset-0 z-50 bg-black/40" />}
			>
				<div className="flex items-start justify-between gap-3">
					<div className="flex flex-col gap-1">
						<Ariakit.DialogHeading className="heading-xs">{title}</Ariakit.DialogHeading>
						{description ? <p className="text-xs text-pro-text-tertiary">{description}</p> : null}
					</div>
					<Ariakit.DialogDismiss
						type="button"
						aria-label="Close preset dialog"
						className="rounded-md p-1.5 text-pro-text-tertiary transition-colors hover:bg-hover-row hover:text-pro-text-primary"
					>
						<Icon name="x" className="size-4" />
					</Ariakit.DialogDismiss>
				</div>

				<form
					onSubmit={(event) => {
						event.preventDefault()
						if (isEmpty) return
						onSave(trimmed, isDuplicate)
					}}
					className="flex flex-col gap-3"
				>
					<label className="flex flex-col gap-1">
						<span className="text-xs font-medium text-pro-text-secondary">Name</span>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							ref={nameRef}
							className="w-full rounded-md border border-subtle bg-transparent px-2.5 py-1.5 text-sm outline-hidden placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand/30"
							placeholder={placeholder}
						/>
					</label>

					{isDuplicate ? (
						<p className="text-xs text-warning">A preset named "{trimmed}" exists — saving will replace it.</p>
					) : null}

					<div className="mt-1 flex justify-end gap-2">
						<Ariakit.DialogDismiss
							type="button"
							className="rounded-md border border-subtle px-3 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary"
						>
							Cancel
						</Ariakit.DialogDismiss>
						<button
							type="submit"
							disabled={isEmpty}
							className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-on-brand transition-colors hover:opacity-90 disabled:opacity-40"
						>
							<Icon name="bookmark" className="size-3.5" />
							{isDuplicate ? replaceLabel : submitLabel}
						</button>
					</div>
				</form>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
