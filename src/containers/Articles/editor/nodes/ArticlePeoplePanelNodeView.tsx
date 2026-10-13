import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Button } from '~/ui/Button'
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
				selected ? 'border-brand' : 'border-medium'
			}`}
		>
			{config ? (
				<ArticlePeoplePanelBlock config={config} compact />
			) : isEditable ? (
				<div className="grid justify-items-center gap-2 py-6">
					<p className="body-md text-tertiary">Empty people panel</p>
					<Button variant="secondary" size="sm" onClick={handleEdit}>
						Configure
					</Button>
				</div>
			) : (
				<p className="py-6 text-center body-md text-tertiary">Empty people panel</p>
			)}

			{isEditable ? (
				// oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- selects the node inside a contenteditable; TipTap owns keyboard navigation there.
				<div
					contentEditable={false}
					onMouseDown={(e) => e.stopPropagation()}
					className={`absolute top-3 right-3 inline-flex items-center gap-1 rounded-md border border-medium bg-overlay p-1 shadow-overlay ${selected ? '' : 'opacity-0 group-hover/people:opacity-100 group-has-focus-visible/people:opacity-100 pointer-coarse:opacity-100'}`}
				>
					<Button variant="ghost" size="sm" onClick={handleEdit}>
						Edit
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							deleteNode()
							editor.commands.focus()
						}}
					>
						Remove
					</Button>
				</div>
			) : null}
		</NodeViewWrapper>
	)
}
