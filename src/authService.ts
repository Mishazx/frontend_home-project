const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
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

  private setToken(token: string | null) {
    this.token = token
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  }

  // Утилита для выполнения запросов с заголовком Authorization
  async fetchJson(path: string, opts: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...(opts.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    // По умолчанию ожидаем JSON. Не ставим Content-Type для FormData и URLSearchParams —
    // браузер сам установит корректный заголовок (multipart/form-data / application/x-www-form-urlencoded).
    const body = opts.body as any
    const isFormData = body instanceof FormData
    const isURLSearchParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams
    if (!headers['Content-Type'] && !isFormData && !isURLSearchParams) {
      headers['Content-Type'] = 'application/json'
    }

    const isAbsolutePath = /^https?:\/\//i.test(path)
    const useRelative = (path && path.startsWith('/')) && (import.meta.env && (import.meta.env as any).DEV)
    const url = isAbsolutePath ? path : (useRelative ? path : `${API_BASE_URL}${path}`)

    const res = await fetch(url, {
      credentials: 'same-origin',
      ...opts,
      headers,
    })

    if (res.status === 401) {
      // Токен недействителен — выходим
      this.logout()
      throw new Error('Неавторизованный доступ (401)')
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Ошибка запроса: ${res.status}`)
    }

    // Попробуем распарсить JSON, иначе вернуть текст
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return res.json()
    }
    return res.text()
  }

  // Утилита для получения сырого Response (для скачивания blob и т.п.)
  async fetchRaw(path: string, opts: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...(opts.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const isAbsolutePath = /^https?:\/\//i.test(path)
    const useRelative = (path && path.startsWith('/')) && (import.meta.env && (import.meta.env as any).DEV)
    const url = isAbsolutePath ? path : (useRelative ? path : `${API_BASE_URL}${path}`)

    const res = await fetch(url, {
      credentials: 'same-origin',
      ...opts,
      headers,
    })

    if (res.status === 401) {
      this.logout()
      throw new Error('Неавторизованный доступ (401)')
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Ошибка запроса: ${res.status}`)
    }

    return res
  }

  async login(username: string, password: string): Promise<User> {
    try {
      const urlBody = new URLSearchParams({ username, password }).toString()
      const data: LoginResponse = await this.fetchJson('/auth/login', {
        method: 'POST',
        body: urlBody,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      if (!data || typeof data.access_token !== 'string') {
        throw new Error('Неверный ответ от сервера при входе')
      }

      // Сохраняем токен централизованно
      this.setToken(data.access_token)

      // Декодируем токен для получения информации о пользователе
      const payload: JwtPayload = JSON.parse(atob(data.access_token.split('.')[1]))
      const user: User = { username: extractUsername(payload) }

      return user
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  logout(): void {
    this.setToken(null)
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
