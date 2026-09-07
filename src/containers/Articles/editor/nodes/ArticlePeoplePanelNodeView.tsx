import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { ArticlePeoplePanelBlock } from '../../renderer/ArticlePeoplePanelBlock'
import { validateArticlePeoplePanel, type ArticlePeoplePanelConfig } from '../peoplePanel'
import { useArticleEditable } from '../useArticleEditable'

export function ArticlePeoplePanelNodeView({ node, selected, deleteNode, getPos, editor }: NodeViewProps) {
	const config = validateArticlePeoplePanel(node.attrs.config) ?? null
	const isEditable = useArticleEditable(editor)

	const handleEdit = () => {
		if (typeof getPos !== 'function') return
		const pos = getPos()
		if (typeof pos !== 'number') return
		const detail: { pos: number; config: ArticlePeoplePanelConfig | null } = { pos, config }
		document.dispatchEvent(new CustomEvent('article:edit-people-panel', { detail }))
	}

	return (
		<NodeViewWrapper
			data-people-panel-wrapper
			className={`group/people not-prose relative my-6 rounded-md border bg-surface p-5 transition-colors ${
				selected ? 'border-link' : 'border-medium'
			}`}
		>
			{config ? (
				<ArticlePeoplePanelBlock config={config} compact />
			) : isEditable ? (
				<button
					type="button"
					onClick={handleEdit}
					className="w-full rounded-md py-6 text-center text-sm text-tertiary transition-colors hover:bg-research-tint-hover hover:text-primary"
				>
					Empty people panel — click to configure
				</button>
			) : (
				<p className="py-6 text-center text-sm text-tertiary">Empty people panel</p>
			)}

			{isEditable ? (
				<div
					contentEditable={false}
					onMouseDown={(e) => e.stopPropagation()}
					className={`absolute top-3 right-3 inline-flex items-center gap-1 rounded-md border border-medium bg-surface p-1 shadow-md ${selected ? '' : 'opacity-0 group-focus-within/people:opacity-100 group-hover/people:opacity-100 pointer-coarse:opacity-100'}`}
				>
					<button
						type="button"
						onClick={handleEdit}
						className="rounded-md px-2 py-1 text-xs font-medium text-secondary transition-colors hover:bg-research-tint-hover hover:text-primary"
					>
						Edit
					</button>
					<button
						type="button"
						onClick={() => {
							deleteNode()
							editor.commands.focus()
						}}
						className="rounded-md px-2 py-1 text-xs font-medium text-secondary transition-colors hover:bg-error/10 hover:text-error"
					>
						Remove
					</button>
				</div>
			) : null}
		</NodeViewWrapper>
	)
}
