import * as Ariakit from '@ariakit/react'
import { useEditorState, type Editor } from '@tiptap/react'
import { useCallback, useLayoutEffect, type ReactNode } from 'react'
import {
	headingAbove,
	readColumnWidths,
	readTableRows,
	TableImageButtons,
	useTableImageWatermark
} from '~/components/TableImage/TableImageButtons'
import { Button } from '~/ui/Button'
import { Icon, type IIcon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { useArticleEditable } from './useArticleEditable'

export function RailButton({
	active,
	disabled,
	onClick,
	label,
	children
}: {
	active?: boolean
	disabled?: boolean
	onClick: () => void
	label: string
	children: ReactNode
}) {
	return (
		<Tooltip
			content={label}
			render={
				<Button
					variant="ghost"
					size="md"
					square
					aria-label={label}
					aria-pressed={active}
					data-active={active}
					onClick={onClick}
					disabled={disabled}
					accessibleWhenDisabled
				/>
			}
		>
			{children}
		</Tooltip>
	)
}

export function RailDivider() {
	return <span aria-hidden className="mx-1 h-5 w-px bg-border-medium" />
}

function TableRailButton({
	label,
	onClick,
	children,
	pressed
}: {
	label: string
	onClick: () => void
	children: ReactNode
	pressed?: boolean
}) {
	return (
		<Tooltip
			content={label}
			render={
				<Button
					variant="ghost"
					size="sm"
					aria-label={label}
					aria-pressed={pressed}
					onClick={onClick}
					onMouseDown={(e) => e.preventDefault()}
				/>
			}
		>
			{children}
		</Tooltip>
	)
}

export function TableControlsOverlay({ editor }: { editor: Editor }) {
	// setEditable emits no transaction, so editability comes from its own subscription.
	const editable = useArticleEditable(editor)
	const target = useEditorState({
		editor,
		selector: ({ editor: e }) => {
			if (!editable || !e.isActive('table')) return null
			const node = e.view.domAtPos(e.state.selection.from).node
			const element = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement
			return element?.closest('table') ?? null
		},
		// The default deep equality would walk the DOM node and ProseMirror's view tree hanging off it.
		equalityFn: (a, b) => a === b
	})
	return target ? <TableToolbar editor={editor} target={target} /> : null
}

function TableToolbar({ editor, target }: { editor: Editor; target: HTMLElement }) {
	const store = Ariakit.usePopoverStore({ defaultOpen: true, placement: 'top-start' })
	useLayoutEffect(() => {
		store.setAnchorElement(target)
		store.show()
	}, [store, target])
	const [watermarkEnabled, toggleWatermark] = useTableImageWatermark()
	const getTableImageSource = useCallback(
		() => ({
			rows: readTableRows(target as HTMLTableElement),
			columnWidths: readColumnWidths(target as HTMLTableElement),
			title: headingAbove(target as HTMLTableElement)
		}),
		[target]
	)
	return (
		<Ariakit.Popover
			store={store}
			role="presentation"
			portal
			fixed
			gutter={8}
			overflowPadding={8}
			fitViewport
			autoFocusOnShow={false}
			autoFocusOnHide={false}
			hideOnInteractOutside={false}
			hideOnEscape={false}
			className="article-table-overlay z-40 max-w-[calc(100vw-16px)] overflow-x-auto rounded-lg border border-medium bg-surface-glass p-1 shadow-overlay backdrop-blur"
		>
			<div role="group" aria-label="Table controls" className="flex w-max items-center gap-0.5">
				<span className="px-1.5 label-xs tracking-[0.18em] text-tertiary uppercase">Table</span>
				<span aria-hidden className="mx-0.5 h-4 w-px bg-border-medium" />
				<TableRailButton label="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
					<span className="mono-sm tracking-wider">HDR</span>
				</TableRailButton>
				<span aria-hidden className="mx-0.5 h-4 w-px bg-border-medium" />
				<TableRailButton label="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
					<span className="mono-sm tracking-wider">↑R</span>
				</TableRailButton>
				<TableRailButton label="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
					<span className="mono-sm tracking-wider">↓R</span>
				</TableRailButton>
				<TableRailButton label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
					<span className="mono-sm tracking-wider">−R</span>
				</TableRailButton>
				<span aria-hidden className="mx-0.5 h-4 w-px bg-border-medium" />
				<TableRailButton label="Add column left" onClick={() => editor.chain().focus().addColumnBefore().run()}>
					<span className="mono-sm tracking-wider">←C</span>
				</TableRailButton>
				<TableRailButton label="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
					<span className="mono-sm tracking-wider">→C</span>
				</TableRailButton>
				<TableRailButton label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
					<span className="mono-sm tracking-wider">−C</span>
				</TableRailButton>
				<span aria-hidden className="mx-0.5 h-4 w-px bg-border-medium" />
				<TableImageButtons
					getSource={getTableImageSource}
					className="contents"
					trigger={<Button variant="ghost" size="sm" />}
					triggerContent={<span className="label-xs tracking-wider">PNG ▾</span>}
					watermarkMode="preference"
					hideWatermarkItem
				/>
				<TableRailButton label="Watermark" pressed={watermarkEnabled} onClick={toggleWatermark}>
					<span className={`label-xs tracking-wider ${watermarkEnabled ? '' : 'text-tertiary line-through'}`}>WM</span>
				</TableRailButton>
				<span aria-hidden className="mx-0.5 h-4 w-px bg-border-medium" />
				<Tooltip
					content="Delete table"
					render={
						<Button
							variant="ghostDestructive"
							size="sm"
							square
							aria-label="Delete table"
							onClick={() => editor.chain().focus().deleteTable().run()}
							onMouseDown={(e) => e.preventDefault()}
						/>
					}
				>
					<Icon name="trash-2" className="size-4" />
				</Tooltip>
			</div>
		</Ariakit.Popover>
	)
}

export type EditorFlags = {
	bold: boolean
	italic: boolean
	underline: boolean
	strike: boolean
	code: boolean
	highlight: boolean
	link: boolean
	entityLink: boolean
	paragraph: boolean
	h2: boolean
	h3: boolean
	bulletList: boolean
	orderedList: boolean
	blockquote: boolean
	codeBlock: boolean
	inTable: boolean
	canUndo: boolean
	canRedo: boolean
}

const EMPTY_FLAGS: EditorFlags = {
	bold: false,
	italic: false,
	underline: false,
	strike: false,
	code: false,
	highlight: false,
	link: false,
	entityLink: false,
	paragraph: false,
	h2: false,
	h3: false,
	bulletList: false,
	orderedList: false,
	blockquote: false,
	codeBlock: false,
	inTable: false,
	canUndo: false,
	canRedo: false
}

export function useEditorFlags(editor: Editor | null): EditorFlags {
	return (
		useEditorState({
			editor,
			selector: ({ editor: e }) =>
				e
					? {
							bold: e.isActive('bold'),
							italic: e.isActive('italic'),
							underline: e.isActive('underline'),
							strike: e.isActive('strike'),
							code: e.isActive('code'),
							highlight: e.isActive('highlight'),
							link: e.isActive('link'),
							entityLink: e.isActive('entityLink'),
							paragraph: e.isActive('paragraph'),
							h2: e.isActive('heading', { level: 2 }),
							h3: e.isActive('heading', { level: 3 }),
							bulletList: e.isActive('bulletList'),
							orderedList: e.isActive('orderedList'),
							blockquote: e.isActive('blockquote'),
							codeBlock: e.isActive('codeBlock'),
							inTable: e.isActive('table'),
							canUndo: e.can().undo(),
							canRedo: e.can().redo()
						}
					: EMPTY_FLAGS,
			equalityFn: (a, b) => {
				if (!a || !b) return a === b
				const ka = Object.keys(a) as Array<keyof EditorFlags>
				return ka.every((k) => a[k] === b[k])
			}
		}) ?? EMPTY_FLAGS
	)
}

export type ActiveEntityLink = {
	entityType: string | null
	slug: string | null
	label: string | null
	route: string | null
}

export function useActiveEntityLink(editor: Editor | null): ActiveEntityLink | null {
	return (
		useEditorState({
			editor,
			selector: ({ editor: e }) => {
				if (!e || !e.isActive('entityLink')) return null
				const a = e.getAttributes('entityLink')
				return {
					entityType: (a.entityType as string | null) ?? null,
					slug: (a.slug as string | null) ?? null,
					label: (a.label as string | null) ?? null,
					route: (a.route as string | null) ?? null
				}
			},
			equalityFn: (a, b) => {
				if (!a && !b) return true
				if (!a || !b) return false
				return a.entityType === b.entityType && a.slug === b.slug && a.route === b.route && a.label === b.label
			}
		}) ?? null
	)
}

export type MarkButton = {
	name: string
	label: string
	icon: IIcon['name']
	isActive: () => boolean
	toggle: () => void
}

export type BlockItem = { label: string; hint?: string; run: () => void }
