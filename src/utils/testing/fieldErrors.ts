/**
 * The field errors shown under `root`, read the way a screen reader reaches them: the `-error` description of every
 * invalid control (`aria-invalid`) and invalid choice group (`Field` / `FieldGroup` in src/ui/Field.tsx). A request
 * failure or other status text in the same color is not a field error, so tests never find errors by class. An error
 * id ends in `-error` (Field's own ids do; a hand-wired error takes `${useId()}-error`), which tells it from a hint.
 */
export function fieldErrorTexts(root: ParentNode = document): Array<string> {
	// One error can describe several controls (two consent boxes under one message); it is one error to the reader.
	const ids = new Set<string>()
	for (const element of root.querySelectorAll('[aria-invalid="true"], [role="group"][data-invalid]')) {
		for (const id of errorIds(element)) ids.add(id)
	}
	const texts: Array<string> = []
	for (const id of ids) {
		const text = document.getElementById(id)?.textContent
		if (text) texts.push(text)
	}
	return texts
}

/**
 * The error one control shows, or null when it is not marked invalid: for a test that needs to know which field
 * carries the error. Read it here, never through `getElementById(aria-describedby)`, which breaks once the field also
 * has a hint (Field describes the control by both ids).
 */
export function fieldErrorOf(control: Element): string | null {
	const invalid = control.getAttribute('aria-invalid') === 'true' || control.hasAttribute('data-invalid')
	if (!invalid) return null
	const id = errorIds(control)[0]
	return id ? (document.getElementById(id)?.textContent ?? null) : null
}

function errorIds(element: Element): Array<string> {
	return (element.getAttribute('aria-describedby')?.split(' ') ?? []).filter((id) => id.endsWith('-error'))
}

/** The request failures shown under `root`: the text of every `role="alert"` (InlineStatus, PanelStatus and the
    other error states in src/ui/Status.tsx). Field errors are not alerts; read them with `fieldErrorTexts`. */
export function alertTexts(root: ParentNode = document): Array<string> {
	return [...root.querySelectorAll('[role="alert"]')].map((element) => element.textContent ?? '')
}
