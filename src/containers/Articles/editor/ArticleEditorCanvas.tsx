import * as Ariakit from '@ariakit/react'
import { isNodeSelection } from '@tiptap/core'
import { EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import { useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { NestedDrawerHeader } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import { formatNumber } from '~/utils/numberFormat'
import type { ArticleCalloutTone } from '../types'
import {
	RailButton,
	RailDivider,
	TableControlsOverlay,
	type ActiveEntityLink,
	type BlockItem,
	type EditorFlags,
	type MarkButton
} from './ArticleEditorControls'
import { Icon } from './ArticleEditorIcon'
import { sanitizeLinkHref } from './ArticleEditorUtils'

type LinkEditState = { url: string; newTab: boolean } | null

const CALLOUT_TONES: Array<ArticleCalloutTone> = ['note', 'data', 'warning', 'pullquote', 'bio']
const CALLOUT_TONE_LABELS: Record<ArticleCalloutTone, string> = {
	note: 'Note',
	data: 'Data',
	warning: 'Warning',
	pullquote: 'Pullquote',
	bio: 'Interview Bio'
}

/** The Callout row of an insert menu and the tone flyout it opens. */
function CalloutMenu({
	insertCallout,
	children
}: {
	insertCallout: (tone: ArticleCalloutTone) => boolean | undefined
	children: ReactNode
}) {
	const menu = Ariakit.useMenuStore()
	return (
		<Ariakit.MenuProvider store={menu}>
			<MenuItem render={<Ariakit.MenuButton />} className="justify-between">
				{children}
				<span aria-hidden className="text-tertiary">
					›
				</span>
			</MenuItem>
			<MenuSurface variant="nested" aria-label="Callout" gutter={4}>
				<NestedDrawerHeader
					title="Callout"
					backLabel="Back to insert menu"
					onBack={menu.hide}
					closeLabel="Close insert menus"
					onClose={menu.hideAll}
				/>
				{CALLOUT_TONES.map((tone) => (
					<MenuItem key={tone} onClick={() => insertCallout(tone)}>
						{CALLOUT_TONE_LABELS[tone]}
					</MenuItem>
				))}
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

/* BubbleMenu places itself only on editor transactions, so a swap of its content (formatting toolbar to the wider
   link form) dispatches this key's 'updatePosition' meta; otherwise the form keeps the toolbar's spot and runs off a phone. */
export const ARTICLE_BUBBLE_MENU_KEY = 'articleBubbleMenu'

/** The bubble's link editor. A link with a scheme other than web, mailto or tel says so under the URL on Save. */
function LinkEditForm({
	editor,
	linkEdit,
	setLinkEdit,
	linkInputRef,
	applyLink,
	canOpen
}: {
	editor: Editor
	linkEdit: { url: string; newTab: boolean }
	setLinkEdit: Dispatch<SetStateAction<LinkEditState>>
	linkInputRef: RefObject<HTMLInputElement | null>
	applyLink: (href: string, newTab: boolean) => void
	canOpen: boolean
}) {
	const [submitted, setSubmitted] = useState(false)
	const url = linkEdit.url.trim()
	// An empty URL removes the link; null is a URL the editor refuses.
	const href = url ? sanitizeLinkHref(url) : ''
	const error = submitted && href === null ? 'Enter a valid web, email (mailto:) or phone (tel:) link.' : null
	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles from the link controls to cancel their shared editor.
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault()
				if (href !== null) return applyLink(href, linkEdit.newTab)
				showFieldErrors(e.currentTarget, () => setSubmitted(true))
				// The error line makes the bubble taller, so it places itself again.
				editor.view.dispatch(editor.state.tr.setMeta(ARTICLE_BUBBLE_MENU_KEY, 'updatePosition'))
			}}
			onKeyDown={(event) => {
				if (event.key !== 'Escape') return
				event.preventDefault()
				event.stopPropagation()
				setLinkEdit(null)
				editor.commands.focus()
			}}
			className="w-[calc(100vw-3rem)] sm:w-auto"
		>
			<Field hideLabel label="Link URL" error={error}>
				{(control) => (
					<div className="flex flex-wrap items-center gap-1 sm:flex-nowrap">
						<input
							{...control}
							ref={linkInputRef}
							value={linkEdit.url}
							onChange={(e) => setLinkEdit({ url: e.target.value, newTab: linkEdit.newTab })}
							placeholder="Paste or type URL"
							className="w-full min-w-0 rounded-md bg-transparent px-2 py-1 body-md text-primary placeholder:text-tertiary focus:outline-hidden sm:w-64"
						/>
						<Button
							variant="ghost"
							size="sm"
							aria-pressed={linkEdit.newTab}
							data-active={linkEdit.newTab}
							onClick={() => setLinkEdit({ url: linkEdit.url, newTab: !linkEdit.newTab })}
						>
							<Icon name="external" className="size-3.5" />
							<span>New tab</span>
						</Button>
						<span aria-hidden className="mx-0.5 h-4 w-px bg-border-medium" />
						<Tooltip
							content="Save link"
							render={<Button type="submit" variant="ghost" size="sm" square aria-label="Save link" />}
						>
							<Icon name="check" className="size-4" />
						</Tooltip>
						<Tooltip
							content="Remove link"
							render={
								<Button
									variant="ghost"
									size="sm"
									square
									onClick={() => applyLink('', linkEdit.newTab)}
									aria-label="Remove link"
								/>
							}
						>
							<Icon name="x" className="size-4" />
						</Tooltip>
						{canOpen && linkEdit.url ? (
							<Tooltip
								content="Open link"
								render={
									<Button
										as="a"
										variant="ghost"
										size="sm"
										square
										href={linkEdit.url}
										target="_blank"
										rel="noreferrer"
										aria-label="Open link"
									/>
								}
							>
								<Icon name="external" className="size-4" />
							</Tooltip>
						) : null}
					</div>
				)}
			</Field>
		</form>
	)
}

type ArticleEditorCanvasProps = {
	activeEntity: ActiveEntityLink | null
	blockItems: Array<BlockItem>
	editor: Editor | null
	flags: EditorFlags
	linkEdit: LinkEditState
	linkInputRef: RefObject<HTMLInputElement | null>
	markButtons: Array<MarkButton>
	readMins: number
	wordCount: number
	applyLink: (href: string, newTab: boolean) => void
	changeActiveEntityLink: () => void
	handleLinkRail: () => void
	insertCallout: (tone: ArticleCalloutTone) => boolean | undefined
	insertCitation: () => void
	onOpenChartPicker: () => void
	onOpenEmbedPicker: () => void
	openActiveEntityLink: () => void
	openLinkEditor: () => void
	setLinkEdit: Dispatch<SetStateAction<LinkEditState>>
	unsetActiveEntityLink: () => void
}

export function ArticleEditorCanvas({
	activeEntity,
	applyLink,
	blockItems,
	changeActiveEntityLink,
	editor,
	flags,
	handleLinkRail,
	insertCallout,
	insertCitation,
	linkEdit,
	linkInputRef,
	markButtons,
	onOpenChartPicker,
	onOpenEmbedPicker,
	openActiveEntityLink,
	openLinkEditor,
	readMins,
	setLinkEdit,
	unsetActiveEntityLink,
	wordCount
}: ArticleEditorCanvasProps) {
	return (
		<>
			<div className="article-editor-canvas relative mt-2">
				<EditorContent editor={editor} />

				{editor ? (
					<BubbleMenu
						editor={editor}
						pluginKey={ARTICLE_BUBBLE_MENU_KEY}
						options={{ placement: 'top', shift: { padding: 8 } }}
						shouldShow={({ editor: e, from, to, state }) => {
							if (linkEdit) return true
							if (isNodeSelection(state.selection)) return false
							if (!e.isEditable) return false
							if (e.isActive('entityLink') && e.isFocused) return true
							if (from === to) return false
							let blocked = false
							state.doc.nodesBetween(from, to, (n) => {
								if (
									n.type.name === 'defillamaChart' ||
									n.type.name === 'articleEmbed' ||
									n.type.name === 'callout' ||
									n.type.name === 'citation'
								)
									blocked = true
								return !blocked
							})
							if (blocked) return false
							return e.isFocused
						}}
						className="article-bubble-menu z-40"
					>
						{/* The URL field has no border of its own, so the bubble's border shows its focus, like Input's border-brand. */}
						<div className="flex items-center gap-0.5 rounded-lg border border-medium bg-surface-glass p-1 shadow-overlay backdrop-blur has-[input:focus]:border-brand">
							{linkEdit ? (
								<LinkEditForm
									editor={editor}
									linkEdit={linkEdit}
									setLinkEdit={setLinkEdit}
									linkInputRef={linkInputRef}
									applyLink={applyLink}
									canOpen={flags.link}
								/>
							) : flags.entityLink && activeEntity ? (
								<div className="flex items-center gap-1">
									<span className="flex items-center gap-2 px-2 py-1">
										{activeEntity.slug ? (
											<span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-medium bg-page">
												<img
													src={
														activeEntity.entityType === 'chain'
															? chainIconUrl(activeEntity.slug)
															: tokenIconUrl(activeEntity.slug)
													}
													alt=""
													className="size-full object-cover"
													onError={(e) => {
														e.currentTarget.style.visibility = 'hidden'
													}}
												/>
											</span>
										) : null}
										<span className="max-w-[160px] truncate label-md text-primary">
											{activeEntity.label || activeEntity.slug || 'Entity'}
										</span>
										<span className="label-xs tracking-[0.18em] text-tertiary uppercase">
											{activeEntity.entityType ?? ''}
										</span>
									</span>
									<span aria-hidden className="mx-0.5 h-4 w-px bg-border-medium" />
									<Button variant="ghost" size="sm" aria-label="Change entity" onClick={changeActiveEntityLink}>
										<Icon name="pencil" className="size-3.5" />
										<span>Change</span>
									</Button>
									<Button variant="ghost" size="sm" aria-label="Unlink entity" onClick={unsetActiveEntityLink}>
										<Icon name="x" className="size-3.5" />
										<span>Unlink</span>
									</Button>
									{activeEntity.route ? (
										<Button
											variant="ghost"
											size="sm"
											aria-label="Open entity in new tab"
											onClick={openActiveEntityLink}
										>
											<Icon name="external" className="size-3.5" />
											<span>Open</span>
										</Button>
									) : null}
								</div>
							) : (
								<>
									{markButtons.map((b) => (
										<Tooltip
											key={b.name}
											content={b.label}
											render={
												<Button
													variant="ghost"
													size="sm"
													square
													aria-label={b.label}
													aria-pressed={b.isActive()}
													data-active={b.isActive()}
													onClick={b.toggle}
												/>
											}
										>
											<Icon name={b.icon} className="size-4" />
										</Tooltip>
									))}
									<span aria-hidden className="mx-0.5 h-4 w-px bg-border-medium" />
									<Tooltip
										content={flags.link ? 'Edit link' : 'Link'}
										render={
											<Button
												variant="ghost"
												size="sm"
												square
												aria-label={flags.link ? 'Edit link' : 'Link'}
												data-active={flags.link}
												onClick={openLinkEditor}
											/>
										}
									>
										<Icon name="link" className="size-4" />
									</Tooltip>
								</>
							)}
						</div>
					</BubbleMenu>
				) : null}

				{editor ? <TableControlsOverlay editor={editor} /> : null}

				{editor ? (
					<FloatingMenu
						editor={editor}
						options={{ placement: 'left-start', offset: 16 }}
						className="article-floating-menu z-30"
					>
						<Ariakit.MenuProvider>
							<Tooltip
								content="Insert block"
								render={
									<Ariakit.MenuButton render={<Button variant="ghost" size="sm" square />} aria-label="Insert block" />
								}
							>
								<Icon name="plus" className="size-4" />
							</Tooltip>
							{/* Portalled like every surface, so its phone sheet is not trapped under the rail in FloatingMenu's z-30
							    layer. Pressing "+" sets tiptap's preventHide, so the editor blur that opening the menu causes keeps it shown. */}
							<MenuSurface variant="actions" gutter={6} className="min-w-[200px]">
								{blockItems.map((item) => (
									<MenuItem key={item.label} onClick={item.run} className="justify-between">
										<span>{item.label}</span>
										{item.hint ? <span className="mono-sm text-tertiary">{item.hint}</span> : null}
									</MenuItem>
								))}
								<MenuItem onClick={onOpenChartPicker} className="justify-between border-t border-subtle">
									<span>DefiLlama chart</span>
									<span className="mono-sm text-tertiary">↗</span>
								</MenuItem>
								<MenuItem
									onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
									className="justify-between"
								>
									<span>Table</span>
									<span className="mono-sm text-tertiary">3×3</span>
								</MenuItem>
								<MenuItem onClick={onOpenEmbedPicker} className="justify-between">
									<span>Embed</span>
									<span className="mono-sm text-tertiary">URL</span>
								</MenuItem>
								<MenuItem
									onClick={() => document.dispatchEvent(new CustomEvent('article:trigger-image-upload'))}
									className="justify-between"
								>
									<span>Image</span>
									<span className="mono-sm text-tertiary">Upload</span>
								</MenuItem>
								<MenuItem
									onClick={() => document.dispatchEvent(new CustomEvent('article:open-people-panel-picker'))}
									className="justify-between"
								>
									<span>People panel</span>
									<span className="mono-sm text-tertiary">Bios</span>
								</MenuItem>
								<CalloutMenu insertCallout={insertCallout}>
									<span>Callout</span>
								</CalloutMenu>
								<MenuItem onClick={insertCitation} className="justify-between">
									<span>Citation</span>
									<span className="mono-sm text-tertiary">[n]</span>
								</MenuItem>
							</MenuSurface>
						</Ariakit.MenuProvider>
					</FloatingMenu>
				) : null}
			</div>

			{editor ? (
				<div className="pointer-events-none sticky bottom-6 z-30 mt-10 flex justify-center">
					<div className="article-editor-rail pointer-events-auto inline-flex max-w-full items-stretch gap-1 overflow-x-auto rounded-2xl border border-medium bg-surface-glass p-1.5 shadow-overlay backdrop-blur">
						<div className="flex shrink-0 items-center gap-1 pl-1">
							<RailButton label="Undo" disabled={!flags.canUndo} onClick={() => editor.chain().focus().undo().run()}>
								<Icon name="undo" className="size-4" />
							</RailButton>
							<RailButton label="Redo" disabled={!flags.canRedo} onClick={() => editor.chain().focus().redo().run()}>
								<Icon name="redo" className="size-4" />
							</RailButton>
							<RailDivider />
						</div>

						<div className="flex shrink-0 items-center gap-1">
							<RailButton
								label="Paragraph"
								active={flags.paragraph}
								onClick={() => editor.chain().focus().setParagraph().run()}
							>
								<span aria-hidden className="label-lg">
									¶
								</span>
							</RailButton>
							<RailButton
								label="Heading 2"
								active={flags.h2}
								onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
							>
								<Icon name="h2" className="size-4" />
							</RailButton>
							<RailButton
								label="Heading 3"
								active={flags.h3}
								onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
							>
								<Icon name="h3" className="size-4" />
							</RailButton>
							<RailButton
								label="Bullet list"
								active={flags.bulletList}
								onClick={() => editor.chain().focus().toggleBulletList().run()}
							>
								<Icon name="list-ul" className="size-4" />
							</RailButton>
							<RailButton
								label="Numbered list"
								active={flags.orderedList}
								onClick={() => editor.chain().focus().toggleOrderedList().run()}
							>
								<Icon name="list-ol" className="size-4" />
							</RailButton>
							<RailButton
								label="Quote"
								active={flags.blockquote}
								onClick={() => editor.chain().focus().toggleBlockquote().run()}
							>
								<Icon name="quote" className="size-4" />
							</RailButton>
							<RailButton
								label="Code block"
								active={flags.codeBlock}
								onClick={() => editor.chain().focus().toggleCodeBlock().run()}
							>
								<Icon name="code-block" className="size-4" />
							</RailButton>
							<RailButton label="Link" onClick={handleLinkRail}>
								<Icon name="link" className="size-4" />
							</RailButton>
						</div>

						<RailDivider />

						<div className="flex shrink-0 items-center gap-1">
							<Button variant="secondary" size="md" onClick={onOpenChartPicker}>
								<Icon name="chart" className="size-3.5" />
								Chart
							</Button>
							<Ariakit.MenuProvider>
								<Ariakit.MenuButton render={<Button variant="ghost" size="md" />}>
									<Icon name="more" className="size-3.5" />
									Insert
								</Ariakit.MenuButton>
								<MenuSurface variant="actions" className="min-w-[200px]">
									<MenuItem
										onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
										className="justify-between"
									>
										<span className="flex items-center gap-2">
											<Icon name="table" className="size-3.5" />
											Table
										</span>
										<span className="mono-sm text-tertiary">3×3</span>
									</MenuItem>
									<MenuItem onClick={onOpenEmbedPicker} className="justify-between">
										<span className="flex items-center gap-2">
											<Icon name="embed" className="size-3.5" />
											Embed
										</span>
										<span className="mono-sm text-tertiary">URL</span>
									</MenuItem>
									<MenuItem
										onClick={() => document.dispatchEvent(new CustomEvent('article:trigger-image-upload'))}
										className="justify-between"
									>
										<span className="flex items-center gap-2">
											<Icon name="image" className="size-3.5" />
											Image
										</span>
										<span className="mono-sm text-tertiary">Upload</span>
									</MenuItem>
									<MenuItem
										onClick={() => document.dispatchEvent(new CustomEvent('article:open-people-panel-picker'))}
										className="justify-between border-b border-subtle"
									>
										<span className="flex items-center gap-2">
											<Icon name="people" className="size-3.5" />
											People panel
										</span>
										<span className="mono-sm text-tertiary">Bios</span>
									</MenuItem>
									<CalloutMenu insertCallout={insertCallout}>
										<span className="flex items-center gap-2">
											<Icon name="callout" className="size-3.5" />
											Callout
										</span>
									</CalloutMenu>
									<MenuItem onClick={insertCitation} className="justify-between">
										<span className="flex items-center gap-2">
											<Icon name="cite" className="size-3.5" />
											Citation
										</span>
										<span className="mono-sm text-tertiary">[n]</span>
									</MenuItem>
								</MenuSurface>
							</Ariakit.MenuProvider>
						</div>

						<RailDivider />

						<div className="hidden shrink-0 items-center gap-3 px-2 label-xs tracking-wider whitespace-nowrap text-tertiary uppercase md:flex">
							<span>{formatNumber(wordCount)} words</span>
							<span aria-hidden className="h-3 w-px bg-border-medium" />
							<span>{readMins} min</span>
						</div>
					</div>
				</div>
			) : null}
		</>
	)
}
