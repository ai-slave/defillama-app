import * as Ariakit from '@ariakit/react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState, type ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { useArticleEditable } from '../useArticleEditable'
import { normalizeImageHref, type ArticleImageAttrs } from './ArticleImage.shared'

const BUTTON_CLASS =
	'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-secondary transition-colors hover:bg-research-tint-hover hover:text-primary'
const INPUT_CLASS =
	'w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden'
const SAVE_CLASS = 'rounded-md bg-research-tint px-3 py-1.5 text-xs font-medium text-link hover:brightness-110'

function ImageDetailsPopover({
	label,
	title,
	hasValue,
	children
}: {
	label: string
	title: string
	hasValue: boolean
	children: ReactNode
}) {
	return (
		<Ariakit.PopoverProvider placement="bottom-end">
			<Ariakit.PopoverDisclosure
				title={title}
				className={`${BUTTON_CLASS} data-open:bg-research-tint data-open:text-link`}
			>
				{label}
				<span aria-hidden className={`size-1.5 rounded-full ${hasValue ? 'bg-link' : 'bg-tertiary/40'}`} />
			</Ariakit.PopoverDisclosure>
			<Ariakit.Popover
				aria-label={title}
				portal
				fixed
				gutter={8}
				overflowPadding={8}
				fitViewport
				unmountOnHide
				className="z-[70] w-80 max-w-[calc(100vw-16px)] overflow-y-auto rounded-md border border-medium bg-surface p-3 shadow-lg"
				style={{ maxHeight: 'var(--popover-available-height)' }}
			>
				{children}
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}

function FormActions() {
	return (
		<div className="flex items-center justify-between">
			<Ariakit.PopoverDismiss className={BUTTON_CLASS}>Cancel</Ariakit.PopoverDismiss>
			<button type="submit" className={SAVE_CLASS}>
				Save
			</button>
		</div>
	)
}

function AltForm({ alt, save }: { alt: string; save: (alt: string) => void }) {
	const [draft, setDraft] = useState(alt)
	const store = Ariakit.usePopoverContext()!
	return (
		<form
			className="grid gap-3"
			onSubmit={(event) => {
				event.preventDefault()
				save(draft.trim())
				store.hide()
			}}
		>
			<label className="grid gap-1.5">
				<span className="text-xs font-medium text-secondary">Alt text</span>
				<textarea
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					rows={3}
					placeholder="Describe the image for screen readers"
					className={`${INPUT_CLASS} resize-none`}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
							event.preventDefault()
							event.currentTarget.form?.requestSubmit()
						}
					}}
				/>
			</label>
			<FormActions />
		</form>
	)
}

function LinkForm({ href, save }: { href: string; save: (href: string) => void }) {
	const [draft, setDraft] = useState(href)
	const store = Ariakit.usePopoverContext()!
	return (
		<form
			className="grid gap-3"
			onSubmit={(event) => {
				event.preventDefault()
				save(normalizeImageHref(draft))
				store.hide()
			}}
		>
			<label className="grid gap-1.5">
				<span className="text-xs font-medium text-secondary">Image link</span>
				<input
					type="text"
					inputMode="url"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					placeholder="https://…"
					className={INPUT_CLASS}
				/>
			</label>
			{href ? (
				<button
					type="button"
					onClick={() => {
						save('')
						store.hide()
					}}
					className="justify-self-start rounded-md px-2 py-1 text-xs text-error"
				>
					Remove link
				</button>
			) : null}
			<FormActions />
		</form>
	)
}

type Credit = Pick<ArticleImageAttrs, 'headline' | 'credit' | 'copyright'>
function CreditForm({ credit, save }: { credit: Credit; save: (credit: Credit) => void }) {
	const [draft, setDraft] = useState(credit)
	const store = Ariakit.usePopoverContext()!
	return (
		<form
			className="grid gap-3"
			onSubmit={(event) => {
				event.preventDefault()
				save({
					headline: draft.headline.trim(),
					credit: draft.credit.trim(),
					copyright: draft.copyright.trim()
				})
				store.hide()
			}}
		>
			<label className="grid gap-1.5">
				<span className="text-xs font-medium text-secondary">Headline</span>
				<input
					value={draft.headline}
					onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
					placeholder="Image title"
					className={INPUT_CLASS}
				/>
			</label>
			<label className="grid gap-1.5">
				<span className="text-xs font-medium text-secondary">Credit</span>
				<input
					value={draft.credit}
					onChange={(event) => setDraft({ ...draft, credit: event.target.value })}
					placeholder="Photographer or illustrator"
					className={INPUT_CLASS}
				/>
			</label>
			<label className="grid gap-1.5">
				<span className="text-xs font-medium text-secondary">Copyright</span>
				<input
					value={draft.copyright}
					onChange={(event) => setDraft({ ...draft, copyright: event.target.value })}
					placeholder="Rights holder"
					className={INPUT_CLASS}
				/>
			</label>
			<FormActions />
		</form>
	)
}

function ImageCaption({
	caption,
	autoFocus,
	save
}: {
	caption: string
	autoFocus: boolean
	save: (caption: string) => void
}) {
	const [draft, setDraft] = useState(caption)
	return (
		<Ariakit.Focusable
			autoFocus={autoFocus}
			render={
				<textarea
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					aria-label="Image caption"
					onBlur={() => save(draft.trim())}
					placeholder="Add a caption…"
					rows={Math.min(3, Math.max(1, draft.split('\n').length))}
					className="w-full resize-none rounded-md border border-medium bg-transparent px-3 py-2 text-sm leading-snug text-secondary outline-hidden focus:border-link"
				/>
			}
		/>
	)
}

export function ArticleImageNodeView({ node, selected, updateAttributes, deleteNode, editor }: NodeViewProps) {
	const attrs = node.attrs as ArticleImageAttrs
	const [captionDraftOpen, setCaptionDraftOpen] = useState(false)
	const showCaption = Boolean(attrs.caption) || captionDraftOpen
	const isUploading = attrs.uploading
	const isEditable = useArticleEditable(editor)

	return (
		<NodeViewWrapper data-article-image-wrapper className="article-image-block group/image not-prose relative my-6">
			<figure
				className={`relative overflow-hidden rounded-md border bg-surface transition-colors ${selected ? 'border-link' : 'border-medium'}`}
			>
				{attrs.src ? (
					<img
						src={attrs.src}
						alt={attrs.alt || ''}
						className="block w-full"
						style={attrs.width && attrs.height ? { aspectRatio: `${attrs.width} / ${attrs.height}` } : undefined}
					/>
				) : (
					<div className="flex aspect-[4/3] w-full items-center justify-center bg-page text-tertiary">
						<div className="flex flex-col items-center gap-2">
							<Icon name="image-plus" className="size-7" />
							<span className="text-xs font-medium">{isUploading ? 'Uploading…' : 'Image'}</span>
						</div>
					</div>
				)}
				{isUploading ? (
					<div
						role="status"
						className="pointer-events-none absolute inset-0 flex items-center justify-center bg-page/40 text-xs font-medium text-secondary"
					>
						<span className="rounded-md bg-surface/95 px-3 py-1.5 shadow-sm">Uploading…</span>
					</div>
				) : null}
				{isEditable && !isUploading ? (
					<div
						contentEditable={false}
						className={`absolute top-3 right-3 left-3 flex w-fit max-w-[calc(100%-24px)] flex-wrap items-center gap-1 rounded-md border border-medium bg-surface p-1 shadow-md ${selected ? '' : 'opacity-0 group-focus-within/image:opacity-100 group-hover/image:opacity-100 pointer-coarse:opacity-100'}`}
					>
						<ImageDetailsPopover label="Alt" title="Image alt text" hasValue={Boolean(attrs.alt)}>
							<AltForm key={attrs.alt} alt={attrs.alt} save={(alt) => updateAttributes({ alt })} />
						</ImageDetailsPopover>
						<ImageDetailsPopover label="Link" title="Image link" hasValue={Boolean(attrs.href)}>
							<LinkForm key={attrs.href} href={attrs.href} save={(href) => updateAttributes({ href })} />
						</ImageDetailsPopover>
						<button
							type="button"
							aria-pressed={showCaption}
							onClick={() => {
								if (showCaption) {
									setCaptionDraftOpen(false)
									updateAttributes({ caption: '' })
								} else setCaptionDraftOpen(true)
							}}
							className={`${BUTTON_CLASS} ${showCaption ? 'bg-research-tint text-link' : ''}`}
						>
							Caption
						</button>
						<ImageDetailsPopover
							label="Credit"
							title="Image credits"
							hasValue={Boolean(attrs.credit || attrs.copyright || attrs.headline)}
						>
							<CreditForm
								key={JSON.stringify([attrs.headline, attrs.credit, attrs.copyright])}
								credit={attrs}
								save={updateAttributes}
							/>
						</ImageDetailsPopover>
						<button
							type="button"
							onClick={() => {
								deleteNode()
								editor.commands.focus()
							}}
							className={`${BUTTON_CLASS} hover:text-error`}
						>
							Remove
						</button>
					</div>
				) : null}
			</figure>
			{showCaption ? (
				<div contentEditable={false} className="mt-2">
					{isEditable ? (
						<ImageCaption
							key={attrs.caption}
							caption={attrs.caption}
							autoFocus={captionDraftOpen}
							save={(caption) => {
								updateAttributes({ caption })
								setCaptionDraftOpen(false)
							}}
						/>
					) : (
						<p className="text-sm text-secondary">{attrs.caption}</p>
					)}
				</div>
			) : null}
		</NodeViewWrapper>
	)
}
