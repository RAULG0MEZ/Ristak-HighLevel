import { authenticateApiToken } from '../utils/apiTokens.js'
import { logger } from '../utils/logger.js'

function extractApiToken(req) {
  const authHeader = req.headers.authorization || ''

  if (/^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '').trim()
  }

  const apiKeyHeader = req.headers['x-api-key']
  if (Array.isArray(apiKeyHeader)) {
    return apiKeyHeader[0]
  }

  return apiKeyHeader || null
}

export async function requireApiToken(req, res, next) {
  try {
    const token = extractApiToken(req)

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'API token no proporcionado'
      })
    }

    const user = await authenticateApiToken(token)

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'API token inválido o revocado'
      })
    }

    req.apiUser = user
    req.user = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      authType: 'api_token'
    }

    next()
  } catch (error) {
    logger.error('Error validando API token:', error)
    res.status(500).json({
      success: false,
      error: 'Error autenticando API token'
    })
  }
}
