/**
 * The field errors shown under `root`, read the way a screen reader reaches them: the `-error` description of every
 * invalid control (`aria-invalid`) and invalid choice group (`Field` / `FieldGroup` in src/ui/Field.tsx). A request
 * failure or other status text in the same colour is not a field error, so tests never find errors by class. An error
 * id ends in `-error` (Field's own ids do; a hand-wired error takes `${useId()}-error`), which tells it from a hint.
 */
export function fieldErrorTexts(root: ParentNode = document): Array<string> {
	// One error can describe several controls (two consent boxes under one message); it is one error to the reader.
	const ids = new Set<string>()
	for (const element of root.querySelectorAll('[aria-invalid="true"], [role="group"][data-invalid]')) {
		for (const id of element.getAttribute('aria-describedby')?.split(' ') ?? []) {
			if (id.endsWith('-error')) ids.add(id)
		}
	}
	const texts: Array<string> = []
	for (const id of ids) {
		const text = document.getElementById(id)?.textContent
		if (text) texts.push(text)
	}
	return texts
}

/** The request failures shown under `root`: the text of every `role="alert"` (InlineStatus, PanelStatus and the
    other error states in src/ui/Status.tsx). Field errors are not alerts; read them with `fieldErrorTexts`. */
export function alertTexts(root: ParentNode = document): Array<string> {
	return [...root.querySelectorAll('[role="alert"]')].map((element) => element.textContent ?? '')
}
