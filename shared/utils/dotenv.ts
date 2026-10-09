export interface EnvEntry {
  key: string
  value: string
}

const LINE = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?$/

// Parses .env text: comments (#), `export KEY=`, single/double quotes,
// escapes and multi-line values in double quotes. Later keys win.
export function parseDotenv(content: string): EnvEntry[] {
  const result = new Map<string, string>()
  const lines = content.replace(/\r\n?/g, '\n').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const match = LINE.exec(lines[i]!)
    if (!match) {
      continue
    }
    const key = match[1]!
    let raw = (match[2] ?? '').trim()
    let value: string

    const quote = raw[0]
    if (quote === '"' || quote === '\'' || quote === '`') {
      // Collect following lines until the closing quote.
      while (!hasClosingQuote(raw, quote) && i + 1 < lines.length) {
        raw += `\n${lines[++i]}`
      }
      const end = raw.lastIndexOf(quote)
      value = end > 0 ? raw.slice(1, end) : raw.slice(1)
      if (quote === '"') {
        value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      }
    } else {
      value = raw.replace(/\s+#.*$/, '').trim()
    }
    result.delete(key)
    result.set(key, value)
  }

  return [...result].map(([key, value]) => ({ key, value }))
}

function hasClosingQuote(raw: string, quote: string) {
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] === '\\' && quote === '"') {
      i++
      continue
    }
    if (raw[i] === quote) {
      return true
    }
  }
  return false
}

export function serializeDotenv(entries: EnvEntry[]) {
  return entries.map(({ key, value }) => `${key}=${quoteValue(value)}`).join('\n')
}

function quoteValue(value: string) {
  if (value === '' || /^[\w./:@,+-]*$/.test(value)) {
    return value
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}
