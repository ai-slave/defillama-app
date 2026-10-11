/* Placeholder artwork for the design system page's demos: plain geometric marks, so no demo borrows a product's
   or a protocol's real logo. Data URIs keep the page free of network and asset files. */

function svg(markup: string) {
	return `data:image/svg+xml,${encodeURIComponent(markup)}`
}

/** A round mark for logo slots (TokenLogo, a picker option, a title strip). */
export const DEMO_LOGO = svg(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#2f6fd8"/><path d="M32 14 47 32 32 50 17 32Z" fill="#fff"/><path d="M32 24 39 32 32 40 25 32Z" fill="#2f6fd8"/></svg>'
)

/** A second mark, so a list of options does not repeat one logo. */
export const DEMO_LOGO_ALT = svg(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#1f8a70"/><circle cx="32" cy="32" r="15" fill="none" stroke="#fff" stroke-width="7"/></svg>'
)

/** A wide picture for image tiles: soft bands in the 7:4 cover shape, so wide, cover and round crops all read. */
export const DEMO_IMAGE = svg(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400"><rect width="700" height="400" fill="#dbe7fb"/><path d="M0 280 C160 200 300 330 460 250 S640 210 700 230 V400 H0Z" fill="#9dbcf0"/><path d="M0 330 C180 280 320 370 500 310 S660 300 700 310 V400 H0Z" fill="#5d8fe0"/><circle cx="540" cy="110" r="46" fill="#fff" opacity="0.85"/></svg>'
)
