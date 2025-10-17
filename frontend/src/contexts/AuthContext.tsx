import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'viewer'
  tenant: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  locationId: string | null
  accessToken: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const defaultUser: User = {
  id: '1',
  name: 'Usuario',
  email: 'usuario@ristak.com',
  role: 'admin',
  tenant: 'ristak'
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => defaultUser)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Cargar datos del location de HighLevel
  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        const response = await fetch('/api/integrations/status')
        const data = await response.json()

        if (data.highlevel?.locationData) {
          const locationData = data.highlevel.locationData
          setUser({
            id: locationData.id || '1',
            name: locationData.name || 'Usuario',
            email: locationData.email || 'usuario@ristak.com',
            role: 'admin',
            tenant: locationData.name || 'ristak'
          })

          // Guardar locationId y accessToken para usar en otras partes de la app
          if (locationData.id) {
            setLocationId(locationData.id)
          }
        }

        // Guardar el accessToken si existe
        if (data.highlevel?.accessToken) {
          setAccessToken(data.highlevel.accessToken)
        }
      } catch (error) {
        // Si falla, mantener usuario por defecto
      }
    }

    fetchLocationData()
  }, [])

  const login = async (email: string) => {
    setUser({ ...defaultUser, email })
  }

  const logout = () => {
    setUser(defaultUser)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        locationId,
        accessToken
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
