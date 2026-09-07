import * as Ariakit from '@ariakit/react'
import { useMutationState, type MutationKey } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { useImageUpload, type UploadResult } from '../upload/useImageUpload'
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
	initialConfig?: ArticlePeoplePanelConfig | null
}

export function PeoplePanelDialog({ store, articleId, onSubmit, initialConfig }: Props) {
	const uploadGroupId = useId()
	const initialPanel = initialConfig ?? makeEmptyPeoplePanelConfig()
	const [label, setLabel] = useState(initialPanel.label)
	const [items, setItems] = useState(() =>
		(initialPanel.items.length > 0 ? initialPanel.items : [makeEmptyPeoplePanelItem()]).map((item) => ({
			id: crypto.randomUUID(),
			item
		}))
	)
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

	const removeItem = (idx: number) => {
		setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
	}

	const addItem = () => {
		setItems((prev) => [...prev, { id: crypto.randomUUID(), item: makeEmptyPeoplePanelItem() }])
	}

	const moveItem = (idx: number, direction: -1 | 1) => {
		setItems((prev) => {
			const next = [...prev]
			const target = idx + direction
			if (target < 0 || target >= next.length) return prev
			;[next[idx], next[target]] = [next[target], next[idx]]
			return next
		})
	}

	// Removed rows may still finish uploading; only people still in this draft block Save.
	const pendingUploadIds = useMutationState({
		filters: { mutationKey: ['article-person-image', uploadGroupId], status: 'pending' },
		select: (mutation) => mutation.options.mutationKey?.[2]
	})
	const hasPendingUploads = items.some(({ id }) => pendingUploadIds.includes(id))
	const itemsHaveImage = items.every(({ item }) => Boolean(item.src))
	const canSubmit = items.length > 0 && itemsHaveImage && !hasPendingUploads

	const submit = () => {
		if (!canSubmit) {
			setShowErrors(true)
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
		<Ariakit.Dialog
			store={store}
			modal
			backdrop={<div className="fixed inset-0 z-[80] bg-research-backdrop backdrop-blur-sm" />}
			className="fixed top-1/2 left-1/2 z-[81] flex max-h-[88vh] w-[min(720px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-medium bg-surface shadow-article-dialog outline-hidden"
		>
			<div className="flex items-center justify-between gap-3 border-b border-medium px-5 py-3">
				<Ariakit.DialogHeading className="text-sm font-semibold tracking-tight text-primary">
					{initialConfig ? 'Edit people panel' : 'Insert people panel'}
				</Ariakit.DialogHeading>
				<Ariakit.DialogDismiss className="rounded-md border border-transparent px-2 py-1 text-xs text-tertiary hover:border-medium hover:text-primary">
					Close
				</Ariakit.DialogDismiss>
			</div>

			<div className="grid gap-5 overflow-y-auto px-5 py-4">
				<label className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">
						Section label (optional)
					</span>
					<input
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						placeholder="e.g. Moderated by:"
						className="rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
					/>
				</label>

				<div className="grid gap-3">
					<div className="flex items-center justify-between">
						<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">People</span>
						<span className="font-jetbrains text-[10px] tracking-tight text-tertiary tabular-nums">
							{items.length} {items.length === 1 ? 'entry' : 'entries'}
						</span>
					</div>
					<div className="grid gap-3">
						{items.map(({ id, item }, idx) => (
							<PersonRow
								key={id}
								uploadKey={['article-person-image', uploadGroupId, id]}
								item={item}
								idx={idx}
								total={items.length}
								articleId={articleId}
								showErrors={showErrors}
								onChange={(patch) => updateItem(id, patch)}
								onRemove={() => removeItem(idx)}
								onMove={(dir) => moveItem(idx, dir)}
							/>
						))}
					</div>
					<button
						type="button"
						onClick={addItem}
						className="rounded-md border border-dashed border-medium bg-page px-3 py-2 text-xs font-medium text-secondary transition-colors hover:border-link/40 hover:text-primary"
					>
						+ Add person
					</button>
				</div>

				{!articleId ? (
					<div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
						Save the article as a draft before adding people — image uploads need an article id.
					</div>
				) : null}
			</div>

			<div className="flex items-center justify-end gap-2 border-t border-medium bg-page/30 px-5 py-3">
				<Ariakit.DialogDismiss className="rounded-md border border-medium px-3 py-2 text-xs text-secondary hover:bg-research-tint-hover">
					Cancel
				</Ariakit.DialogDismiss>
				<button
					type="button"
					disabled={!canSubmit}
					onClick={submit}
					className="rounded-md bg-research-tint px-3 py-2 text-xs font-medium text-link shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{hasPendingUploads ? 'Uploading images…' : initialConfig ? 'Update panel' : 'Insert panel'}
				</button>
			</div>
		</Ariakit.Dialog>
	)
}

type RowProps = {
	uploadKey: MutationKey
	item: ArticlePeoplePanelItem
	idx: number
	total: number
	articleId: string | null
	showErrors: boolean
	onChange: (patch: Partial<ArticlePeoplePanelItem>) => void
	onRemove: () => void
	onMove: (direction: -1 | 1) => void
}

function PersonRow({ uploadKey, item, idx, total, articleId, showErrors, onChange, onRemove, onMove }: RowProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const { uploadWithToast, isUploading } = useImageUpload({
		scope: 'article-inline',
		articleId,
		mutationKey: uploadKey
	})

	const handleFile = async (file: File | null | undefined) => {
		if (!file) return
		try {
			const result: UploadResult = await uploadWithToast(file)
			onChange({ imageId: result.id, src: result.url, width: result.width, height: result.height })
		} catch {
			// surfaced via toast
		}
		if (inputRef.current) inputRef.current.value = ''
	}

	const missingImage = showErrors && !item.src

	return (
		<div
			className={`grid grid-cols-[80px_minmax(0,1fr)_auto] gap-4 rounded-md border bg-page/40 p-3 ${
				missingImage ? 'border-error/50' : 'border-medium'
			}`}
		>
			<input
				ref={inputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
				className="hidden"
				aria-label={`Upload image for person ${idx + 1}`}
				onChange={(e) => handleFile(e.target.files?.[0])}
			/>
			<button
				type="button"
				disabled={isUploading || !articleId}
				onClick={() => inputRef.current?.click()}
				className="group relative aspect-square overflow-hidden rounded-full border border-medium bg-surface outline-hidden transition-[border-color] hover:border-link/50 focus-visible:border-link disabled:cursor-not-allowed disabled:opacity-60"
				aria-label={item.src ? 'Replace image' : 'Upload image'}
			>
				{item.src ? (
					<>
						<img src={item.src} alt="" className="h-full w-full object-cover" />
						<span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-research-invert/0 text-[10px] font-medium tracking-wide text-on-brand opacity-0 transition-opacity group-hover:bg-research-backdrop-soft group-hover:opacity-100">
							{isUploading ? '…' : 'Replace'}
						</span>
					</>
				) : (
					<span className="flex h-full w-full items-center justify-center text-[10px] font-medium tracking-[0.16em] text-tertiary uppercase">
						{isUploading ? '…' : 'Upload'}
					</span>
				)}
			</button>

			<div className="grid min-w-0 gap-2">
				<input
					value={item.name}
					onChange={(e) => onChange({ name: e.target.value })}
					aria-label={`Person ${idx + 1} name, role, organization`}
					placeholder="Name, role, organization"
					className="rounded-md border border-medium bg-surface px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
				/>
				<textarea
					value={item.bio}
					onChange={(e) => onChange({ bio: e.target.value })}
					rows={3}
					aria-label={`Person ${idx + 1} biography`}
					placeholder="Short bio paragraph"
					className="resize-y rounded-md border border-medium bg-surface px-3 py-2 text-sm leading-snug text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
				/>
				<input
					type="url"
					inputMode="url"
					value={item.href}
					onChange={(e) => onChange({ href: e.target.value })}
					aria-label={`Person ${idx + 1} link`}
					placeholder="Link (optional) — e.g. https://twitter.com/…"
					className="rounded-md border border-medium bg-surface px-3 py-2 text-xs text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
				/>
				{missingImage ? <span className="text-[11px] text-error">An image is required for each person.</span> : null}
			</div>

			<div className="flex flex-col items-stretch gap-1">
				<button
					type="button"
					onClick={() => onMove(-1)}
					disabled={idx === 0}
					title="Move up"
					aria-label={`Move person ${idx + 1} up`}
					className="border border-medium bg-surface px-2 py-1 font-jetbrains text-[10px] text-tertiary transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
				>
					↑
				</button>
				<button
					type="button"
					onClick={() => onMove(1)}
					disabled={idx === total - 1}
					title="Move down"
					aria-label={`Move person ${idx + 1} down`}
					className="border border-medium bg-surface px-2 py-1 font-jetbrains text-[10px] text-tertiary transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
				>
					↓
				</button>
				<button
					type="button"
					onClick={onRemove}
					disabled={total === 1}
					title="Remove"
					aria-label={`Remove person ${idx + 1}`}
					className="border border-medium bg-surface px-2 py-1 font-jetbrains text-[10px] text-tertiary transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
				>
					×
				</button>
			</div>
		</div>
	)
}
