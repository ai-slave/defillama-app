import { Field } from '~/ui/Field'
import { Input, Textarea } from '~/ui/Input'

interface TextTabProps {
	textTitle: string
	textContent: string
	onTextTitleChange: (title: string) => void
	onTextContentChange: (content: string) => void
	/** What Add still needs (some content), shown under the content once Add was pressed. */
	error: string | null
}

export function TextTab({ textTitle, textContent, onTextTitleChange, onTextContentChange, error }: TextTabProps) {
	return (
		<div className="space-y-3 md:space-y-4">
			<Field label="Card name (optional)">
				{(control) => (
					<Input
						{...control}
						type="text"
						value={textTitle}
						onChange={(e) => onTextTitleChange(e.target.value)}
						placeholder="Optional"
						className="w-full"
					/>
				)}
			</Field>
			<Field
				label="Content (Markdown)"
				hint="Supports markdown: **bold**, *italic*, # headers, - lists, `code`, [links](url)"
				error={error}
			>
				{(control) => (
					<Textarea
						{...control}
						required
						value={textContent}
						onChange={(e) => onTextContentChange(e.target.value)}
						placeholder="Enter markdown content…"
						rows={8}
						className="w-full resize-none"
					/>
				)}
			</Field>
		</div>
	)
}
