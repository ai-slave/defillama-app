// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest'
import { neighborRowControl } from '../focus'

afterEach(() => document.body.replaceChildren())

// Rows whose status icons differ, as a loading row's spinner and a ready row's check do.
function list(names: Array<string>) {
	document.body.innerHTML = `<ul>${names
		.map(
			(name, index) =>
				`<li><button>Preview ${name}</button>${index === 0 ? '<svg><use href="#spinner"></use></svg>' : ''}<button>Remove ${name}</button></li>`
		)
		.join('')}</ul>`
	const remove = (name: string) =>
		[...document.querySelectorAll('button')].find((button) => button.textContent === `Remove ${name}`)!
	return { remove, row: (name: string) => remove(name).closest('li')! }
}

test("a leaving row hands focus to the next row's same control, whatever icons the rows show", () => {
	const { remove, row } = list(['Alpha', 'Beta', 'Gamma'])
	expect(neighborRowControl(row('Alpha'), remove('Alpha'))?.textContent).toBe('Remove Beta')
})

test("the last row hands focus to the previous row's same control", () => {
	const { remove, row } = list(['Alpha', 'Beta'])
	expect(neighborRowControl(row('Beta'), remove('Beta'))?.textContent).toBe('Remove Alpha')
})

test('a row that is its own control hands focus to the neighbor row itself', () => {
	const { row } = list(['Alpha', 'Beta'])
	expect(neighborRowControl(row('Beta'), row('Beta'))).toBe(row('Alpha'))
})
