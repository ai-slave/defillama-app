import { expect, test } from 'vitest'
import { serializeCsv } from '../csv'

test('quotes every kind of embedded record delimiter and preserves numeric and missing cells', () => {
	expect(
		serializeCsv([
			['Name', 'Notes', 'Value'],
			['Alpha', 'one\rtwo', -2.5],
			['Beta', 'one\r\ntwo', 0],
			['Gamma', 'one\ntwo', null],
			['Delta, "D"', '=1+1', false]
		])
	).toBe(
		'Name,Notes,Value\nAlpha,"one\rtwo",-2.5\nBeta,"one\r\ntwo",0\nGamma,"one\ntwo",\n"Delta, ""D""","\'=1+1",false'
	)
})
