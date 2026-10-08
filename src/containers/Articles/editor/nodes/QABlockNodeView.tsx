import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps, useEditorState } from '@tiptap/react'
import { useRef } from 'react'
import { formatAutomaticQAQuestionNumber, normalizeQAQuestionNumber } from '../../qa'
import { useArticleEditable } from '../useArticleEditable'

function getAutomaticQuestionIndex(doc: ProseMirrorNode, targetPos: number | undefined): number {
	if (typeof targetPos !== 'number') return 1

	let index = 0
	let targetIndex = 1
	doc.descendants((node, pos) => {
		if (pos > targetPos) return false
		if (node.type.name !== 'qa') return true

		index += 1
		if (pos === targetPos) targetIndex = index
		return false
	})

	return targetIndex
}

function getQuestionNumberInputWidth(characterCount: number): string {
	return `calc(${Math.max(2, characterCount)}ch + 1em)`
}

export function QABlockNodeView({ node, updateAttributes, getPos, editor }: NodeViewProps) {
	const questionNumber = normalizeQAQuestionNumber(node.attrs.questionNumber)
	const cancelCommitRef = useRef(false)
	const isEditable = useArticleEditable(editor)
	const automaticQuestionNumber = useEditorState({
		editor,
		selector: ({ editor: currentEditor }) => {
			const pos = typeof getPos === 'function' ? getPos() : undefined
			return formatAutomaticQAQuestionNumber(getAutomaticQuestionIndex(currentEditor.state.doc, pos))
		}
	})

	const commit = (input: HTMLInputElement) => {
		const next = normalizeQAQuestionNumber(input.value)
		input.value = next ?? ''
		if (next === questionNumber) return
		updateAttributes({ questionNumber: next })
	}

	const handleBlur = (input: HTMLInputElement) => {
		if (cancelCommitRef.current) {
			cancelCommitRef.current = false
			return
		}
		commit(input)
	}

	return (
		<NodeViewWrapper
			as="div"
			data-article-qa="true"
			data-qa-node-view="true"
			data-qa-number={questionNumber ?? undefined}
			className="article-qa"
		>
			{/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- selects the node inside a contenteditable; TipTap owns keyboard navigation there. */}
			<div
				contentEditable={false}
				onMouseDown={(event) => event.stopPropagation()}
				className="article-qa-number-editor"
			>
				<span>Q · </span>
				{isEditable ? (
					<input
						key={questionNumber ?? 'automatic'}
						type="text"
						inputMode="numeric"
						pattern="[0-9]*"
						maxLength={4}
						defaultValue={questionNumber ?? ''}
						placeholder={automaticQuestionNumber}
						aria-label="Question number"
						onChange={(event) => {
							const next = normalizeQAQuestionNumber(event.currentTarget.value) ?? ''
							event.currentTarget.value = next
							event.currentTarget.style.width = getQuestionNumberInputWidth(
								next.length > 0 ? next.length : automaticQuestionNumber.length
							)
						}}
						onBlur={(event) => handleBlur(event.currentTarget)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault()
								event.currentTarget.blur()
								editor.commands.focus()
							}
							if (event.key === 'Escape') {
								event.preventDefault()
								cancelCommitRef.current = true
								event.currentTarget.value = questionNumber ?? ''
								event.currentTarget.blur()
								editor.commands.focus()
							}
						}}
						style={{
							width: getQuestionNumberInputWidth(
								questionNumber && questionNumber.length > 0 ? questionNumber.length : automaticQuestionNumber.length
							)
						}}
						className="font-inherit h-[1.4em] appearance-none rounded-xs border-b border-dashed border-transparent bg-transparent p-0 leading-[1.4] text-inherit placeholder:text-link placeholder:opacity-100 hover:border-medium"
					/>
				) : (
					<span>{questionNumber ?? automaticQuestionNumber}</span>
				)}
			</div>
			<NodeViewContent<'dl'> as="dl" />
		</NodeViewWrapper>
	)
}
