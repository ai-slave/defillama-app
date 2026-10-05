import { useTabContext } from '@ariakit/react'
import { useId, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogCancelButton } from '~/ui/Dialog'
import { Input } from '~/ui/Input'
import { presetNameKey, type SavedDownload } from './savedDownloads'

interface SavePresetDialogProps {
	suggestedName: string
	existingNames: Array<string>
	/** Saving under a taken name (case-insensitive) replaces that preset. */
	onSave: (name: string) => void
	onClose: () => void
	title?: string
	description?: string
	placeholder?: string
}

/** Saving under a taken name replaces that preset, and the dialog says so before the reader commits. */
export function SavePresetDialog({
	title = 'Save preset',
	description = 'Saved presets let you re-run this download with the same columns and filters.',
	placeholder = 'e.g. Aave fees, weekly',
	...props
}: SavePresetDialogProps) {
	return (
		<PresetNameDialog
			{...props}
			title={title}
			description={description}
			submitLabel="Save"
			placeholder={placeholder}
			onNameTaken="replace"
		/>
	)
}

/** Renaming never takes another preset's name: that would leave two presets the list cannot tell apart. */
export function RenamePresetDialog({
	preset,
	presets,
	onRename,
	onClose
}: {
	preset: SavedDownload
	presets: Array<SavedDownload>
	onRename: (id: string, name: string) => void
	onClose: () => void
}) {
	const otherNames: Array<string> = []
	for (const other of presets) {
		if (other.id !== preset.id) otherNames.push(other.name)
	}
	return (
		<PresetNameDialog
			suggestedName={preset.name}
			existingNames={otherNames}
			title="Rename preset"
			submitLabel="Rename"
			placeholder="Preset name"
			onNameTaken="reject"
			onSave={(name) => {
				if (name !== preset.name) onRename(preset.id, name)
				onClose()
			}}
			onClose={onClose}
		/>
	)
}

function PresetNameDialog({
	suggestedName,
	existingNames,
	onSave,
	onClose,
	title,
	description,
	submitLabel,
	placeholder,
	onNameTaken
}: Required<Omit<SavePresetDialogProps, 'description'>> & {
	description?: string
	submitLabel: string
	onNameTaken: 'replace' | 'reject'
}) {
	const id = useId()
	const nameRef = useRef<HTMLInputElement>(null)
	const [name, setName] = useState(suggestedName)

	const trimmed = name.trim()
	const key = presetNameKey(trimmed)
	const takenName = trimmed ? existingNames.find((existing) => presetNameKey(existing) === key) : undefined
	const rejected = takenName !== undefined && onNameTaken === 'reject'

	return (
		<Dialog
			open
			onClose={onClose}
			size="sm"
			portal
			unmountOnHide
			initialFocus={nameRef}
			render={
				<form
					onSubmit={(event) => {
						event.preventDefault()
						if (!trimmed || rejected) return
						onSave(trimmed)
					}}
				/>
			}
		>
			<DialogHeader title={title} subtitle={description} />
			<DialogBody>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-name`} className="label-sm text-secondary">
						Name
					</label>
					<Input
						id={`${id}-name`}
						ref={nameRef}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={placeholder}
						aria-invalid={rejected ? true : undefined}
						aria-describedby={takenName !== undefined ? `${id}-taken` : undefined}
					/>
					{takenName !== undefined ? (
						<p id={`${id}-taken`} className={`body-sm ${rejected ? 'text-data-down' : 'text-warning'}`}>
							{rejected
								? `Another preset is named "${takenName}". Choose a different name.`
								: `A preset named "${takenName}" exists. Saving replaces it.`}
						</p>
					) : null}
				</div>
			</DialogBody>
			<DialogFooter dismiss={<DialogCancelButton />}>
				<Button type="submit" size="md" variant="primary" disabled={!trimmed || rejected}>
					{takenName !== undefined && !rejected ? 'Replace' : submitLabel}
				</Button>
			</DialogFooter>
		</Dialog>
	)
}

/** Opened from a saved list inside a tab panel. Deleting removes the row that opened it, so focus returns to the
    panel's selected tab instead. */
export function DeletePresetDialog({
	preset,
	onDelete,
	onClose
}: {
	preset: SavedDownload
	onDelete: (id: string) => void
	onClose: () => void
}) {
	const tabs = useTabContext()!
	const returnFocusRef = useRef<HTMLElement | null>(null)
	return (
		<ConfirmDialog
			open
			onClose={onClose}
			portal
			unmountOnHide
			finalFocus={returnFocusRef}
			title="Delete preset?"
			description={`"${preset.name}" is removed from your saved presets. This can't be undone.`}
			confirmLabel="Delete"
			pendingLabel={null}
			error={null}
			onConfirm={() => {
				returnFocusRef.current = tabs.item(tabs.getState().selectedId)?.element ?? null
				onDelete(preset.id)
				onClose()
			}}
		/>
	)
}
