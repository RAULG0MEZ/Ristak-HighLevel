const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g

const SPECIAL_CHARACTER_REPLACEMENTS: Record<string, string> = {
  æ: 'ae',
  ø: 'o',
  œ: 'oe',
  ß: 'ss',
  đ: 'd',
  ð: 'd',
  ħ: 'h',
  ł: 'l',
  þ: 'th'
}

const normalizeSearchText = (value: unknown): string => {
  return String(value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .toLowerCase()
    .replace(/[æøœßđðħłþ]/g, character => SPECIAL_CHARACTER_REPLACEMENTS[character] || character)
    .replace(/\s+/g, ' ')
    .trim()
}

export const searchTextIncludes = (value: unknown, query: unknown): boolean => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  return normalizeSearchText(value).includes(normalizedQuery)
}

export const someSearchTextIncludes = (values: unknown[], query: unknown): boolean => {
  return values.some(value => searchTextIncludes(value, query))
}
