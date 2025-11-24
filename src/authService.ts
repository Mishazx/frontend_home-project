const API_BASE_URL = 'http://127.0.0.1:8000'
const TOKEN_KEY = 'auth_token'

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface User {
  username: string
}

type JwtPayload = {
  sub: string | { username?: string; [key: string]: unknown }
  exp?: number
}

const extractUsername = (payload: JwtPayload): string => {
  if (typeof payload.sub === 'string') {
    return payload.sub
  }

  if (payload.sub && typeof payload.sub === 'object') {
    const nestedUsername = payload.sub.username
    if (typeof nestedUsername === 'string' && nestedUsername.trim().length > 0) {
      return nestedUsername
    }
    // fallback: попробуем взять любое строковое поле
    const fallback = Object.values(payload.sub).find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    )
    if (typeof fallback === 'string') {
      return fallback
    }
  }

  return 'Пользователь'
}

class AuthService {
  private token: string | null = null

  constructor() {
    // Восстанавливаем токен из localStorage при инициализации
    this.token = localStorage.getItem(TOKEN_KEY)
  }

  async login(username: string, password: string): Promise<User> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username,
          password,
        }),
      })

      if (!response.ok) {
        throw new Error('Неверные учетные данные')
      }

      const data: LoginResponse = await response.json()

      // Сохраняем токен
      this.token = data.access_token
      localStorage.setItem(TOKEN_KEY, this.token)

      // Декодируем токен для получения информации о пользователе
      const payload: JwtPayload = JSON.parse(atob(this.token.split('.')[1]))
      const user: User = { username: extractUsername(payload) }

      return user
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  logout(): void {
    this.token = null
    localStorage.removeItem(TOKEN_KEY)
  }

  getToken(): string | null {
    return this.token
  }

  isAuthenticated(): boolean {
    return this.token !== null
  }

  getAuthHeaders(): { Authorization: string } | {} {
    if (this.token) {
      return { Authorization: `Bearer ${this.token}` }
    }
    return {}
  }

  // Метод для проверки токена при загрузке приложения
  async validateToken(): Promise<User | null> {
    if (!this.token) return null

    try {
      // Можно добавить проверку токена через API, но пока просто возвращаем пользователя из токена
      const payload: JwtPayload = JSON.parse(atob(this.token.split('.')[1]))
      const user: User = { username: extractUsername(payload) }

      // Проверяем, не истек ли токен
      const currentTime = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < currentTime) {
        this.logout()
        return null
      }

      return user
    } catch (error) {
      console.error('Token validation error:', error)
      this.logout()
      return null
    }
  }
}

export const authService = new AuthService()
