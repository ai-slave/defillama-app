const PLACEHOLDER_SRC = '/assets/placeholder.png'

/**
 * Points a broken logo at the placeholder, once.
 *
 * Which stage a logo is at is read back from its own `src` rather than stored, because these images are
 * reused: React keeps the same element and only updates `src` when a different token is selected, so a
 * marker or class left behind would follow the next token and hide a logo that loads perfectly well.
 * Selecting another token rewrites `src`, which resets this on its own.
 *
 * Nothing happens once the placeholder is in place. That is what ends it: any assignment, even of an
 * empty source, starts another request that can fail and call this again. The obvious guard does not
 * end it either, which is the bug this replaces:
 *
 *     img.onerror = null
 *     img.src = PLACEHOLDER_SRC
 *
 * React registers `error` with `addEventListener` and never assigns the DOM `on` property, so clearing
 * that property cannot detach React's handler. Reassigning the same failing source on every error left
 * the image reloading instead of settling, which is why a logo could end up showing nothing at all.
 */
export function applyLogoFallback(image: HTMLImageElement): void {
	if (image.getAttribute('src') === PLACEHOLDER_SRC) return
	image.setAttribute('src', PLACEHOLDER_SRC)
}
