interface TextTabProps {
	textTitle: string
	textContent: string
	onTextTitleChange: (title: string) => void
	onTextContentChange: (content: string) => void
}

export function TextTab({ textTitle, textContent, onTextTitleChange, onTextContentChange }: TextTabProps) {
	const titleInputId = 'add-chart-text-tab-title'
	const contentInputId = 'add-chart-text-tab-content'

	return (
		<div className="space-y-3 md:space-y-4">
			<div>
				<label htmlFor={titleInputId} className="mb-1.5 block label-md text-secondary md:mb-2">
					Card name (optional)
				</label>
				<input
					id={titleInputId}
					type="text"
					value={textTitle}
					onChange={(e) => onTextTitleChange(e.target.value)}
					placeholder="Optional"
					className="w-full rounded-md border border-medium bg-surface-elevated-1 px-3 py-2 body-md text-primary placeholder:text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden md:body-lg"
				/>
			</div>
			<div>
				<label htmlFor={contentInputId} className="mb-1.5 block label-md text-secondary md:mb-2">
					Content (Markdown)
				</label>
				<textarea
					id={contentInputId}
					value={textContent}
					onChange={(e) => onTextContentChange(e.target.value)}
					placeholder="Enter markdown content..."
					rows={8}
					className="md:rows-12 w-full resize-none rounded-md border border-medium bg-surface-elevated-1 px-3 py-2 body-sm text-primary placeholder:text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden md:body-md"
				/>
				<div className="mt-1.5 body-sm text-tertiary md:mt-2">
					Supports markdown: **bold**, *italic*, # headers, - lists, `code`, [links](url)
				</div>
			</div>
		</div>
	)
}
