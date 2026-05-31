const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g

const SQL_TEXT_FOLD_REPLACEMENTS = [
  ['\u00c1', 'A'], ['\u00e1', 'a'],
  ['\u00c9', 'E'], ['\u00e9', 'e'],
  ['\u00cd', 'I'], ['\u00ed', 'i'],
  ['\u00d3', 'O'], ['\u00f3', 'o'],
  ['\u00da', 'U'], ['\u00fa', 'u'],
  ['\u00dc', 'U'], ['\u00fc', 'u'],
  ['\u00d1', 'N'], ['\u00f1', 'n']
]

const SQL_COMBINING_MARKS = [
  '\u0300',
  '\u0301',
  '\u0302',
  '\u0303',
  '\u0308',
  '\u0327'
]

const SQL_PHONE_STRIP_CHARS = [' ', '-', '(', ')', '+', '.', '\u00a0']

function quoteSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

export function cleanSearchText(value, maxLength = 500) {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim()
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned
}

export function normalizeSearchText(value, maxLength = 500) {
  return cleanSearchText(value, maxLength)
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS_PATTERN, '')
}

export function normalizePhoneDigits(value) {
  return cleanSearchText(value, 120).replace(/\D/g, '')
}

export function containsPattern(value, maxLength = 500) {
  const normalized = normalizeSearchText(value, maxLength)
  return normalized ? `%${normalized}%` : ''
}

export function textFoldExpression(sqlExpression) {
  let expression = `COALESCE(${sqlExpression}, '')`

  for (const [from, to] of SQL_TEXT_FOLD_REPLACEMENTS) {
    expression = `REPLACE(${expression}, ${quoteSqlLiteral(from)}, ${quoteSqlLiteral(to)})`
  }

  for (const mark of SQL_COMBINING_MARKS) {
    expression = `REPLACE(${expression}, ${quoteSqlLiteral(mark)}, '')`
  }

  return `LOWER(${expression})`
}

export function phoneDigitsExpression(sqlExpression) {
  let expression = `COALESCE(${sqlExpression}, '')`

  for (const char of SQL_PHONE_STRIP_CHARS) {
    expression = `REPLACE(${expression}, ${quoteSqlLiteral(char)}, '')`
  }

  return expression
}

export function buildContactSearchCondition(alias = 'contacts', options = {}) {
  const prefix = alias ? `${alias}.` : ''
  const fullName = `${prefix}full_name`
  const firstName = `${prefix}first_name`
  const lastName = `${prefix}last_name`
  const email = `${prefix}email`
  const phone = `${prefix}phone`
  const id = `${prefix}id`
  const joinedName = `COALESCE(${fullName}, '') || ' ' || COALESCE(${firstName}, '') || ' ' || COALESCE(${lastName}, '')`

  const conditions = [
    `${textFoldExpression(fullName)} LIKE ?`,
    `${textFoldExpression(joinedName)} LIKE ?`,
    `${textFoldExpression(email)} LIKE ?`,
    `${phoneDigitsExpression(phone)} LIKE ?`,
    `${textFoldExpression(id)} LIKE ?`
  ]

  if (options.includeSource) {
    conditions.push(`${textFoldExpression(`${prefix}source`)} LIKE ?`)
    conditions.push(`${textFoldExpression(`${prefix}attribution_session_source`)} LIKE ?`)
  }

  if (options.includeAdName) {
    conditions.push(`${textFoldExpression(`${prefix}attribution_ad_name`)} LIKE ?`)
  }

  return `(${conditions.join(' OR ')})`
}

export function buildContactSearchParams(value, options = {}) {
  const textLike = containsPattern(value, 500) || '__no_text_match__'
  const digits = normalizePhoneDigits(value)
  const phoneLike = digits ? `%${digits}%` : '__no_phone_match__'
  const params = [textLike, textLike, textLike, phoneLike, textLike]

  if (options.includeSource) {
    params.push(textLike, textLike)
  }

  if (options.includeAdName) {
    params.push(textLike)
  }

  return params
}

export function getSearchTokens(value, { minLength = 2, maxTokens = 6 } = {}) {
  return normalizeSearchText(value, 240)
    .split(/[^a-z0-9@._+-]+/)
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) return false
      if (/^\d+$/.test(token) && token.length < 7) return false
      return token.length >= minLength
    })
    .slice(0, maxTokens)
}

export function buildFoldedTokenCondition(sqlExpression, tokenCount) {
  if (!tokenCount) return ''

  const foldedExpression = textFoldExpression(sqlExpression)
  return Array.from({ length: tokenCount }, () => `${foldedExpression} LIKE ?`).join(' AND ')
}

export function buildFoldedTokenParams(tokens = []) {
  return tokens
    .map((token) => normalizeSearchText(token, 80))
    .filter(Boolean)
    .map((token) => `%${token}%`)
}

export function buildContactSearchClause(alias = 'contacts', value, options = {}) {
  const prefix = alias ? `${alias}.` : ''
  const fullName = `${prefix}full_name`
  const firstName = `${prefix}first_name`
  const lastName = `${prefix}last_name`
  const joinedName = `COALESCE(${fullName}, '') || ' ' || COALESCE(${firstName}, '') || ' ' || COALESCE(${lastName}, '')`
  const tokens = getSearchTokens(value)
  const tokenParams = buildFoldedTokenParams(tokens)
  const extraTokenParams = tokenParams.length >= 2 ? tokenParams : []
  const tokenCondition = extraTokenParams.length
    ? buildFoldedTokenCondition(joinedName, tokenParams.length)
    : ''

  return {
    condition: tokenCondition
      ? `(${buildContactSearchCondition(alias, options)} OR (${tokenCondition}))`
      : buildContactSearchCondition(alias, options),
    params: [
      ...buildContactSearchParams(value, options),
      ...extraTokenParams
    ]
  }
}
