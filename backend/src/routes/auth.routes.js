import express from 'express'
import { login, verifyTokenEndpoint, changePassword, changeUsername, getMe } from '../controllers/authController.js'

const router = express.Router()

// POST /api/auth/login - Autenticar usuario
router.post('/login', login)

// POST /api/auth/verify - Verificar token JWT
router.post('/verify', verifyTokenEndpoint)

// POST /api/auth/change-password - Cambiar contraseña
router.post('/change-password', changePassword)

// POST /api/auth/change-username - Cambiar nombre de usuario
router.post('/change-username', changeUsername)

// GET /api/auth/me - Obtener información del usuario autenticado
router.get('/me', getMe)

export default router
