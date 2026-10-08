import * as Ariakit from '@ariakit/react'
import { useMutationState, type MutationKey } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogCancelButton, DialogDiscardGuard, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, textareaStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { useImageUpload } from '../upload/useImageUpload'
import {
	makeEmptyPeoplePanelConfig,
	makeEmptyPeoplePanelItem,
	type ArticlePeoplePanelConfig,
	type ArticlePeoplePanelItem
} from './peoplePanel'

type Props = {
	store: Ariakit.DialogStore
	articleId: string | null
	onSubmit: (config: ArticlePeoplePanelConfig) => void
	initialConfig: ArticlePeoplePanelConfig | null
}

const getImageButtonId = (groupId: string, rowId: string) => `${groupId}-${rowId}-image`

export function PeoplePanelDialog({ store, articleId, onSubmit, initialConfig }: Props) {
	const uploadGroupId = useId()
	const labelId = useId()
	const initialPanel = initialConfig ?? makeEmptyPeoplePanelConfig()
	const [label, setLabel] = useState(initialPanel.label)
	const [items, setItems] = useState(() =>
		(initialPanel.items.length > 0 ? initialPanel.items : [makeEmptyPeoplePanelItem()]).map((item) => ({
			id: crypto.randomUUID(),
			item
		}))
	)
	// The panel as the reader edits it: leaving with it changed asks first, and an outside tap never drops it.
	const draftSnapshot = JSON.stringify({ label, items: items.map(({ item }) => item) })
	const [openedSnapshot] = useState(draftSnapshot)
	// Set by an insert with a person still missing an image; each row's error then follows its own image.
	const [showErrors, setShowErrors] = useState(false)

	const updateItem = (id: string, patch: Partial<ArticlePeoplePanelItem>) => {
		setItems((prev) => {
			const index = prev.findIndex((entry) => entry.id === id)
			if (index === -1) return prev
			const next = [...prev]
			next[index] = { ...prev[index], item: { ...prev[index].item, ...patch } }
			return next
		})
	}

	const addPersonRef = useRef<HTMLButtonElement>(null)
	// The removed row's × hands focus to the next row's ×, else the one above; with one person left, nothing more can
	// go, so Add person takes it.
	const removeItem = (idx: number, remove: HTMLElement) => {
		const next = items.length > 2 ? neighbourRowControl(remove.closest('fieldset')!, remove) : addPersonRef.current
		keepFocus(
			() => setItems((prev) => prev.filter((_, i) => i !== idx)),
			() => next
		)
	}

	const addItem = () => {
		setItems((prev) => [...prev, { id: crypto.randomUUID(), item: makeEmptyPeoplePanelItem() }])
	}

	const moveItem = (idx: number, direction: -1 | 1) => {
		// The end rows' arrows are disabled, so the target always exists.
		setItems((prev) => {
			const next = [...prev]
			const target = idx + direction
			;[next[idx], next[target]] = [next[target], next[idx]]
			return next
		})
	}

	// Removed rows may still finish uploading; only people still in this draft hold Insert.
	const pendingUploadIds = useMutationState({
		filters: { mutationKey: ['article-person-image', uploadGroupId], status: 'pending' },
		select: (mutation) => mutation.options.mutationKey?.[2]
	})
	const hasPendingUploads = items.some(({ id }) => pendingUploadIds.includes(id))

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (hasPendingUploads) return
		const firstMissing = items.find(({ item }) => !item.src)
		if (firstMissing) {
			// Render the row errors before focusing, so the focused image button is announced with its error.
			flushSync(() => setShowErrors(true))
			document.getElementById(getImageButtonId(uploadGroupId, firstMissing.id))?.focus()
			return
		}
		onSubmit({
			label: label.trim(),
			items: items.map(({ item }) => ({
				...item,
				name: item.name.trim(),
				bio: item.bio.trim(),
				href: item.href.trim()
			}))
		})
		store.hide()
	}

	return (
		<Dialog store={store} size="md" unmountOnHide portal>
			<form onSubmit={submit} className="flex min-h-0 flex-auto flex-col">
				<DialogDiscardGuard
					when={draftSnapshot !== openedSnapshot}
					title="Discard this people panel?"
					description="The people and bios you entered are not added to the article."
				/>
				<DialogHeader title={initialConfig ? 'Edit people panel' : 'Insert people panel'} />
				<DialogBody>
					{!articleId ? (
						<InlineStatus variant="warning">
							Save the article as a draft before adding people. Image uploads need a saved article.
						</InlineStatus>
					) : null}

					<div className="flex flex-col gap-1.5">
						<label htmlFor={labelId} className="label-sm text-secondary">
							Section label (optional)
						</label>
						<Input id={labelId} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Moderated by:" />
					</div>

					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between gap-2">
							<h3 className="label-sm text-secondary">People</h3>
							<span className="body-sm text-tertiary tabular-nums">
								{items.length} {items.length === 1 ? 'person' : 'people'}
							</span>
						</div>
						{items.map(({ id, item }, idx) => (
							<PersonRow
								key={id}
								uploadKey={['article-person-image', uploadGroupId, id]}
								imageButtonId={getImageButtonId(uploadGroupId, id)}
								item={item}
								idx={idx}
								total={items.length}
								articleId={articleId}
								showErrors={showErrors}
								onChange={(patch) => updateItem(id, patch)}
								onRemove={(remove) => removeItem(idx, remove)}
								onMove={(dir) => moveItem(idx, dir)}
							/>
						))}
						<Button ref={addPersonRef} type="button" size="md" onClick={addItem} className="w-full">
							<Icon name="plus" className="size-3.5" aria-hidden="true" />
							Add person
						</Button>
					</div>
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button
						type="submit"
						size="md"
						variant="primary"
						pendingLabel={hasPendingUploads ? 'Uploading images…' : null}
					>
						{initialConfig ? 'Update panel' : 'Insert panel'}
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	)
}

type RowProps = {
	uploadKey: MutationKey
	imageButtonId: string
	item: ArticlePeoplePanelItem
	idx: number
	total: number
	articleId: string | null
	showErrors: boolean
	onChange: (patch: Partial<ArticlePeoplePanelItem>) => void
	onRemove: (remove: HTMLElement) => void
	onMove: (direction: -1 | 1) => void
}

function PersonRow({
	uploadKey,
	imageButtonId,
	item,
	idx,
	total,
	articleId,
	showErrors,
	onChange,
	onRemove,
	onMove
}: RowProps) {
	const fieldId = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const { uploadFile, isUploading, errorMessage } = useImageUpload({
		scope: 'article-inline',
		articleId,
		mutationKey: uploadKey
	})

	const handleFile = async (file: File | null | undefined) => {
		if (!file) return
		try {
			const result = await uploadFile(file)
			onChange({ imageId: result.id, src: result.url, width: result.width, height: result.height })
		} catch {
			// Shown under this person's image through errorMessage.
		}
		if (inputRef.current) inputRef.current.value = ''
	}

	const imageError = errorMessage ?? (showErrors && !item.src ? 'An image is required for each person.' : null)
	const person = idx + 1
	const upRef = useRef<HTMLButtonElement>(null)
	const downRef = useRef<HTMLButtonElement>(null)
	// React re-inserts a moved row's nodes, which drops focus. The arrow follows its row, or hands focus to the other
	// arrow once the row reaches the end.
	const move = (direction: -1 | 1) => {
		flushSync(() => onMove(direction))
		const atEnd = direction === -1 ? idx - 1 === 0 : idx + 1 === total - 1
		const [sameArrow, otherArrow] = direction === -1 ? [upRef, downRef] : [downRef, upRef]
		;(atEnd ? otherArrow : sameArrow).current?.focus()
	}

	return (
		<fieldset className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 rounded-lg border border-subtle p-3 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:gap-4">
			{/* Every field has its visible label; the legend tells the rows apart for screen readers, as the move and
			    remove buttons' names do. */}
			<legend className="sr-only">Person {person}</legend>
			<input
				ref={inputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
				className="hidden"
				aria-label={`Upload image for person ${person}`}
				onChange={(e) => handleFile(e.target.files?.[0])}
			/>
			<div className="col-start-1 row-start-1 flex flex-col gap-1.5">
				<Ariakit.Button
					id={imageButtonId}
					disabled={isUploading || !articleId}
					accessibleWhenDisabled
					aria-busy={isUploading || undefined}
					aria-invalid={imageError ? true : undefined}
					aria-describedby={imageError ? `${fieldId}-image-error` : undefined}
					onClick={() => inputRef.current?.click()}
					className={`group relative aspect-square w-20 overflow-hidden rounded-full border bg-surface transition-[border-color] not-aria-disabled:hover:border-brand aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${
						imageError ? 'border-error' : 'border-medium'
					}`}
					aria-label={item.src ? 'Replace image' : 'Upload image'}
				>
					{item.src ? (
						<>
							<img src={item.src} alt="" className="h-full w-full object-cover" />
							<span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-research-backdrop-soft label-sm text-research-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
								Replace
							</span>
						</>
					) : (
						<span className="flex h-full w-full items-center justify-center label-sm text-tertiary">Upload</span>
					)}
					{isUploading ? (
						<span className="absolute inset-0 flex items-center justify-center bg-research-backdrop-soft">
							<LoadingSpinner size={16} />
							<span className="sr-only">Uploading</span>
						</span>
					) : null}
				</Ariakit.Button>
			</div>

			<div className="col-span-2 row-start-2 flex min-w-0 flex-col gap-3 sm:col-span-1 sm:col-start-2 sm:row-start-1">
				{imageError ? (
					<p id={`${fieldId}-image-error`} className="body-sm text-data-down">
						{imageError}
					</p>
				) : null}
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${fieldId}-name`} className="label-sm text-secondary">
						Name, role and organization
					</label>
					<Input
						id={`${fieldId}-name`}
						value={item.name}
						onChange={(e) => onChange({ name: e.target.value })}
						placeholder="Jane Doe, Head of Research, DefiLlama"
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${fieldId}-bio`} className="label-sm text-secondary">
						Bio
					</label>
					<textarea
						id={`${fieldId}-bio`}
						value={item.bio}
						onChange={(e) => onChange({ bio: e.target.value })}
						rows={3}
						placeholder="Short bio paragraph"
						className={`${textareaStyles} resize-y`}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${fieldId}-link`} className="label-sm text-secondary">
						Link (optional)
					</label>
					<Input
						id={`${fieldId}-link`}
						inputMode="url"
						value={item.href}
						onChange={(e) => onChange({ href: e.target.value })}
						placeholder="https://x.com/…"
					/>
				</div>
			</div>

			{/* 12px between the buttons keeps their 44px touch targets apart on desktop, where they draw at 32px. */}
			<div className="col-start-2 row-start-1 flex items-start justify-end gap-3 sm:col-start-3 sm:flex-col sm:justify-start">
				{/* The arrows and × disable themselves at the ends; they stay focusable so focus never drops to the page. */}
				<Tooltip
					content="Move up"
					render={
						<Button
							type="button"
							variant="ghost"
							size="md"
							square
							ref={upRef}
							accessibleWhenDisabled
							disabled={idx === 0}
							onClick={() => move(-1)}
							aria-label={`Move person ${person} up`}
						/>
					}
				>
					<Icon name="arrow-up" className="size-4" aria-hidden="true" />
				</Tooltip>
				<Tooltip
					content="Move down"
					render={
						<Button
							type="button"
							variant="ghost"
							size="md"
							square
							ref={downRef}
							accessibleWhenDisabled
							disabled={idx === total - 1}
							onClick={() => move(1)}
							aria-label={`Move person ${person} down`}
						/>
					}
				>
					<Icon name="arrow-down" className="size-4" aria-hidden="true" />
				</Tooltip>
				<Tooltip
					content="Remove"
					render={
						<Button
							type="button"
							variant="ghost"
							size="md"
							square
							accessibleWhenDisabled
							disabled={total === 1}
							onClick={(event) => onRemove(event.currentTarget)}
							aria-label={`Remove person ${person}`}
						/>
					}
				>
					<Icon name="x" className="size-4" aria-hidden="true" />
				</Tooltip>
			</div>
		</fieldset>
	)
}
