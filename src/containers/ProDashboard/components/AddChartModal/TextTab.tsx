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
				<label htmlFor={titleInputId} className="mb-1.5 block text-sm font-medium text-pro-text-secondary md:mb-2">
					Title (Optional)
				</label>
				<input
					id={titleInputId}
					type="text"
					value={textTitle}
					onChange={(e) => onTextTitleChange(e.target.value)}
					placeholder="Enter text title..."
					className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-3 py-2 text-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden md:text-base"
				/>
			</div>
			<div>
				<label htmlFor={contentInputId} className="mb-1.5 block text-sm font-medium text-pro-text-secondary md:mb-2">
					Content (Markdown)
				</label>
				<textarea
					id={contentInputId}
					value={textContent}
					onChange={(e) => onTextContentChange(e.target.value)}
					placeholder="Enter markdown content..."
					rows={8}
					className="md:rows-12 w-full resize-none rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-3 py-2 text-xs text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden md:text-sm"
				/>
				<div className="mt-1.5 text-xs text-pro-text-tertiary md:mt-2">
					Supports markdown: **bold**, *italic*, # headers, - lists, `code`, [links](url)
				</div>
			</div>
		</div>
	)
}
