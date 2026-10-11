import { expect, test } from 'vitest'
import pages from '~/public/pages.json'
import { MENU_VARIANT_B } from '../menuVariant'

// An icon helps find a row again only when no other row in the same sidebar wears it.
function repeatedIcons(rows: Array<{ icon?: string }>) {
	const icons = rows.flatMap((row) => (row.icon ? [row.icon] : []))
	return icons.filter((icon, index) => icons.indexOf(icon) !== index)
}

test('no icon repeats within either sidebar layout', () => {
	expect(repeatedIcons([...pages.Main, ...pages.Premium])).toEqual([])
	expect(repeatedIcons([...MENU_VARIANT_B, ...pages.Premium])).toEqual([])
})
