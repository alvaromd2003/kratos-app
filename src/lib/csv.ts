// Thrown instead of silently merging the rest of the file into one giant
// field — a single stray `"` (e.g. an unescaped inch-mark like `12" pizza`)
// used to make everything after it fail validation with no indication that
// a quoting typo, not bad data, was the actual cause.
export class UnterminatedQuoteError extends Error {}

// Minimal RFC 4180-ish CSV parser — handles quoted fields (with embedded
// commas/newlines) and "" as an escaped quote. No external dependency
// needed for the menu-import feature's fairly small, simple files.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Normalizes CRLF/CR to LF up front so the single-pass scan below only
  // ever has to reason about one line-ending character.
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (inQuotes) {
    throw new UnterminatedQuoteError('CSV file has an unterminated quote')
  }

  // Trailing field/row not yet flushed by a final newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // A blank trailing line (common when a spreadsheet app adds one) would
  // otherwise show up as a phantom all-empty row.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}
