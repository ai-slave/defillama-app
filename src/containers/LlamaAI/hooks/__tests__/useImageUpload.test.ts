import { describe, expect, test } from 'vitest'
import { maxSizeForFile } from '../useImageUpload'

const MB = 1024 * 1024

describe('maxSizeForFile', () => {
	test('allows data files up to 100MB so large CSV exports can be attached in chat', () => {
		expect(maxSizeForFile(new File([''], 'launches.csv', { type: 'text/csv' }))).toBe(100 * MB)
		expect(maxSizeForFile(new File([''], 'notes.md', { type: 'text/markdown' }))).toBe(100 * MB)
		expect(maxSizeForFile(new File([''], 'dump.txt', { type: 'text/plain' }))).toBe(100 * MB)
	})

	test('keeps a PDF at 30MB because it is sent to the model as a document', () => {
		expect(maxSizeForFile(new File([''], 'report.pdf', { type: 'application/pdf' }))).toBe(30 * MB)
	})

	test('allows workbooks and documents up to 100MB: the server converts them into the data and PDF lanes', () => {
		expect(
			maxSizeForFile(
				new File([''], 'book.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
			)
		).toBe(100 * MB)
		expect(
			maxSizeForFile(
				new File([''], 'notes.docx', {
					type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
				})
			)
		).toBe(100 * MB)
		expect(maxSizeForFile(new File([''], 'book.xlsx', { type: '' }))).toBe(100 * MB)
	})

	test('keeps images at 10MB', () => {
		expect(maxSizeForFile(new File([''], 'chart.png', { type: 'image/png' }))).toBe(10 * MB)
	})

	test('classifies a CSV by extension when the browser reports an Excel mime', () => {
		expect(maxSizeForFile(new File([''], 'launches.csv', { type: 'application/vnd.ms-excel' }))).toBe(100 * MB)
	})
})
