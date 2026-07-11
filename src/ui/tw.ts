/** Identity tag for exported class-string recipes. Zero runtime cost — it
    returns the literal unchanged. Its only job is to put recipe strings inside
    a construct oxfmt's `sortTailwindcss.functions` allowlist recognizes, so
    their class order is normalized on format like every `className` attribute.
    Interpolation is deliberately a type error: a recipe must be one static
    string for the sorter to see all of it — compose already-tagged parts with
    template literals or `clsx` at the call site instead. */
export function tw(strings: TemplateStringsArray, ...values: never[]): string {
	void values
	return strings[0]
}
