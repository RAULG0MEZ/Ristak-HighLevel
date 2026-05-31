import { verifyToken } from '../utils/auth.js'
import { db } from '../config/database.js'

export async function requireAuth(req, res, next) {
  try {
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

    const user = await db.get(
      'SELECT id, username, email, role FROM users WHERE id = ? AND is_active = 1',
      [payload.userId]
    )

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado o inactivo'
      })
    }

    req.user = {
      ...payload,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
    next()
  } catch (error) {
    next(error)
  }
}
