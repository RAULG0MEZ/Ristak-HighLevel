import React, { useState, FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, User, UserPlus } from 'lucide-react'
import { Button } from '@/components/common'
import { useAuth } from '@/contexts/AuthContext'
import { getLoginPathForRoute, getPostAuthRedirectPath, type RedirectLocation } from '@/utils/phoneAccess'
import styles from './Login.module.css'

type SetupLocationState = {
  from?: RedirectLocation
} | null

export const Setup: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { isAuthenticated, setupAccount, needsSetup } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fromLocation = (location.state as SetupLocationState)?.from
  const redirectPath = getPostAuthRedirectPath(fromLocation)

  // Si el setup ya terminó, mandar a la pantalla correcta sin pedir los datos otra vez.
  if (!needsSetup) {
    return isAuthenticated
      ? <Navigate to={redirectPath} replace />
      : <Navigate to={getLoginPathForRoute(fromLocation?.pathname || location.pathname)} replace state={location.state} />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (!username || !password || !confirmPassword) {
      setError('Por favor llena todos los campos')
      return
    }

    if (username.length < 3) {
      setError('El usuario debe tener al menos 3 caracteres')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setIsLoading(true)

    try {
      await setupAccount(username, password)
      navigate(redirectPath, { replace: true })
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <div className={styles.logo}>
              <UserPlus size={32} strokeWidth={1.5} />
            </div>
          </div>
          <h1 className={styles.title}>Ristak</h1>
          <p className={styles.subtitle}>Configura tu acceso</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="username" className={styles.label}>
              Usuario
            </label>
            <div className={styles.inputWrapper}>
              <User size={18} className={styles.inputIcon} />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
                placeholder="ej. raul"
                autoComplete="username"
                disabled={isLoading}
                minLength={3}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                minLength={6}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirmar contraseña
            </label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            className={styles.submitButton}
          >
            Crear mi acceso
          </Button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(100, 116, 139, 0.08)',
          borderRadius: '0.75rem',
          fontSize: '0.8125rem',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          ✨ Esta es la única vez que crearás tu usuario. Después ingresas con estas credenciales.
        </div>
      </div>
    </div>
  )
}
