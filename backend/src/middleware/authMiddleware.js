import { verifyToken } from '../utils/auth.js'

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token no proporcionado'
    })
  }

  const payload = verifyToken(authHeader.substring(7))

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    })
  }

  req.user = payload
  next()
}
