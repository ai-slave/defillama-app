/**
 * The Monaco themes for the SQL editor and notebook cells. Monaco cannot read `var()`, so each colour is the literal
 * hex of the token named beside it in src/styles/primitives.css or semantics.css; keep them in sync.
 */

export const LIGHT_THEME_ID = 'llama-sql-light'
export const DARK_THEME_ID = 'llama-sql-dark'

const llamaSqlLight = {
	base: 'vs',
	inherit: true,
	rules: [
		{ token: '', foreground: '090b0c' }, // text-primary
		{ token: 'keyword', foreground: '145abe', fontStyle: 'bold' }, // blue-11
		{ token: 'keyword.sql', foreground: '145abe', fontStyle: 'bold' }, // blue-11
		{ token: 'operator.sql', foreground: '145abe' }, // blue-11
		{ token: 'predefined.sql', foreground: '6f41c2' }, // violet-11
		{ token: 'identifier', foreground: '090b0c' }, // text-primary
		{ token: 'number', foreground: '007b45' }, // emerald-9
		{ token: 'number.sql', foreground: '007b45' }, // emerald-9
		{ token: 'string', foreground: '9f5a00' }, // amber-9
		{ token: 'string.sql', foreground: '9f5a00' }, // amber-9
		{ token: 'comment', foreground: '5e5e5e', fontStyle: 'italic' }, // text-tertiary
		{ token: 'delimiter', foreground: '484848' } // text-secondary
	],
	colors: {
		'editor.background': '#ffffff', // bg-surface
		'editor.foreground': '#090b0c', // text-primary
		'editorLineNumber.foreground': '#b3b3b3', // neutral-7
		'editorLineNumber.activeForeground': '#145abe', // blue-11
		'editor.lineHighlightBackground': '#1f67d20d', // blue-9 at 5%
		'editor.lineHighlightBorder': '#00000000',
		'editorCursor.foreground': '#145abe', // blue-11
		'editorIndentGuide.background1': '#090b0c0f', // border-subtle
		'editor.selectionBackground': '#d0def3', // blue-4
		'editor.inactiveSelectionBackground': '#dde7f6', // blue-3
		'editorGutter.background': '#ffffff', // bg-surface
		'editorWidget.background': '#ffffff', // bg-overlay
		'editorWidget.border': '#090b0c1f', // border-medium
		'editorSuggestWidget.background': '#ffffff', // bg-overlay
		'editorSuggestWidget.border': '#090b0c1f', // border-medium
		'editorSuggestWidget.selectedBackground': '#d0def3', // bg-brand-muted (blue-4)
		'editorSuggestWidget.selectedForeground': '#090b0c', // text-primary
		'editorSuggestWidget.focusHighlightForeground': '#145abe' // text-link (blue-11)
	}
}

const llamaSqlDark = {
	base: 'vs-dark',
	inherit: true,
	rules: [
		{ token: '', foreground: 'ffffff' }, // text-primary
		{ token: 'keyword', foreground: '599aff', fontStyle: 'bold' }, // blue-11
		{ token: 'keyword.sql', foreground: '599aff', fontStyle: 'bold' }, // blue-11
		{ token: 'operator.sql', foreground: '599aff' }, // blue-11
		{ token: 'predefined.sql', foreground: 'a884ff' }, // violet-11
		{ token: 'identifier', foreground: 'ffffff' }, // text-primary
		{ token: 'number', foreground: 'abf0c2' }, // emerald-12
		{ token: 'number.sql', foreground: 'abf0c2' }, // emerald-12
		{ token: 'string', foreground: 'ffdaba' }, // amber-12
		{ token: 'string.sql', foreground: 'ffdaba' }, // amber-12
		{ token: 'comment', foreground: '989b9c', fontStyle: 'italic' }, // text-tertiary
		{ token: 'delimiter', foreground: 'c6c6c6' } // text-secondary
	],
	colors: {
		'editor.background': '#131516', // bg-surface
		'editor.foreground': '#ffffff', // text-primary
		'editorLineNumber.foreground': '#414345', // neutral-7
		'editorLineNumber.activeForeground': '#599aff', // blue-11
		'editor.lineHighlightBackground': '#1f67d224', // blue-9 at 14%
		'editor.lineHighlightBorder': '#00000000',
		'editorCursor.foreground': '#599aff', // blue-11
		'editorIndentGuide.background1': '#ffffff0f', // border-subtle
		'editor.selectionBackground': '#28436e', // blue-7
		'editor.inactiveSelectionBackground': '#212f44', // blue-5
		'editorGutter.background': '#131516', // bg-surface
		'editorWidget.background': '#181a1b', // bg-overlay
		'editorWidget.border': '#ffffff1f', // border-medium
		'editorSuggestWidget.background': '#181a1b', // bg-overlay
		'editorSuggestWidget.border': '#ffffff1f', // border-medium
		'editorSuggestWidget.selectedBackground': '#1c2636' // bg-brand-muted (blue-4)
	}
}

export function defineSqlEditorThemes(monaco: any) {
	monaco.editor.defineTheme(LIGHT_THEME_ID, llamaSqlLight)
	monaco.editor.defineTheme(DARK_THEME_ID, llamaSqlDark)
}
