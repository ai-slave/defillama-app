import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

/** A definition beside a label, as a help-circle icon. Not an action, so not a button: a focusable span (keyboard
    readers can open it) named by the definition itself, because the icon has no text. The name lives on the anchor,
    not on the tooltip, since the tooltip unmounts while hidden.

    It sits beside what it explains, never inside a heading, a label, a `Checkbox` or a control: its name would join
    theirs, and a tap there goes to the control. A definition of a control (a toggle option, a row button) is a
    tooltip anchored on the control itself, with the help-circle Icon in its label only as a mark (`aria-hidden`):
    a focusable "?" inside would be a second tab stop within the control (policy: check-focus-handoff; Tooltip also
    reports one at runtime).

    The anchor keeps Tooltip's default trigger box (block-level flex), so `className` lands on the icon inside it and
    `ml-auto` still pushes the icon to the end of a table cell. */
export function QuestionHelper({ text, className }: { text: string; className?: string }) {
	return (
		<Tooltip
			content={text}
			render={<span role="img" aria-label={text} className="flex shrink-0 cursor-help items-center" />}
			tabIndex={0}
		>
			<Icon name="help-circle" className={`size-4 text-tertiary ${className ?? ''}`.trim()} />
		</Tooltip>
	)
}
