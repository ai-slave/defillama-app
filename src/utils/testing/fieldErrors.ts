/**
 * The field errors shown under `root`, read the way a screen reader reaches them: the `-error` description of every
 * invalid control (`aria-invalid`) and invalid choice group (`Field` / `FieldGroup` in src/ui/Field.tsx). A request
 * failure or other status text in the same colour is not a field error, so tests never find errors by class.
 */
export function fieldErrorTexts(root: ParentNode = document): Array<string> {
	const texts: Array<string> = []
	for (const element of root.querySelectorAll('[aria-invalid="true"], [role="group"][data-invalid]')) {
		for (const id of element.getAttribute('aria-describedby')?.split(' ') ?? []) {
			if (!id.endsWith('-error')) continue
			const text = element.ownerDocument.getElementById(id)?.textContent
			if (text) texts.push(text)
		}
	}
	return texts
}
