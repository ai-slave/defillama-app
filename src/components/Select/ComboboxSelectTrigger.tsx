import * as Ariakit from '@ariakit/react'

/** Ariakit's ComboboxSelect, for every picker trigger. A list without a search field keeps focus on its trigger, inside
    any dialog around it. Ariakit closes the list on Escape and lets the key go on to that dialog, which closes too and
    drops its draft. While the list is open, the trigger takes Escape for the list alone, before Ariakit's own handler. */
export function ComboboxSelectTrigger(props: Ariakit.ComboboxSelectProps) {
	const store = Ariakit.useComboboxContext()!
	return (
		<Ariakit.ComboboxSelect
			{...props}
			onKeyDownCapture={(event) => {
				props.onKeyDownCapture?.(event)
				if (event.key !== 'Escape' || !store.getState().open) return
				event.stopPropagation()
				store.hide()
			}}
		/>
	)
}
