import { useEffect, useRef, useState, useCallback } from 'react'

type UseWebSocketOptions = {
  url?: string
  token?: string | null
  onMessage?: (data: any) => void
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { url, token = null, onMessage, autoReconnect = true, reconnectInterval = 1000 } = options
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number>(0)
  const manuallyClosedRef = useRef<boolean>(false)
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [error, setError] = useState<any>(null)
  const [closeEvent, setCloseEvent] = useState<CloseEvent | null>(null)

  const onMessageRef = useRef<typeof onMessage | null>(null)

  // keep latest onMessage in a ref to avoid recreating connect/useEffect loops
  useEffect(() => {
    onMessageRef.current = onMessage || null
  }, [onMessage])

  const buildUrl = useCallback(() => {
    if (url) return url
    try {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      // По умолчанию используем отдельный админский WebSocket путь `/admin/ws`.
      // Формируем URL так, чтобы он подключался к текущему origin (Vite dev-server),
      // а прокси в `vite.config.ts` перенаправит его на бэкенд (или gateway).
      return `${proto}://${window.location.host}/admin/ws`
    } catch (e) {
      return url || ''
    }
  }, [url])

  const connect = useCallback(() => {
    const wsUrl = buildUrl()
    if (!wsUrl) return

    try {
      // Передаём JWT как subprotocol вместо query param, чтобы не логировать токен в URL
      // браузеры поддерживают указание subprotocols в конструкторе WebSocket.
      const protocols = token ? [`Bearer ${token}`] : undefined
      const socket = new WebSocket(wsUrl, protocols)
      wsRef.current = socket

      // Если соединение не открылось за N мс — трактуем как ошибка и закрываем
      const OPEN_TIMEOUT = 8000
      let openTimer: number | undefined = window.setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
          try {
            wsRef.current.close()
          } catch (_) {}
          setError(new Error('WebSocket open timeout'))
        }
      }, OPEN_TIMEOUT)

      socket.addEventListener('open', () => {
        reconnectRef.current = 0
        setConnected(true)
        setError(null)
        if (openTimer) {
          clearTimeout(openTimer)
          openTimer = undefined
        }
      })

      socket.addEventListener('message', (ev) => {
        let raw: any = ev.data
          // Если сервер вернул HTML (например, страница ошибки), безопасно сохраняем строку
          if (typeof raw === 'string' && raw.trim().startsWith('<')) {
            setLastMessage(raw)
            if (onMessageRef.current) onMessageRef.current(raw)
            return
          }

        let parsed: any = raw
        if (typeof raw === 'string') {
          try {
            parsed = JSON.parse(raw)
          } catch (_err) {
            // не JSON, оставляем как строку
            parsed = raw
          }
        }
        setLastMessage(parsed)
        if (onMessageRef.current) onMessageRef.current(parsed)
      })

      socket.addEventListener('close', (ev) => {
        setConnected(false)
        setCloseEvent(ev)
        // Если мы закрыли соединение вручную, не переподключаем
        if (manuallyClosedRef.current) return

        if (autoReconnect) {
          reconnectRef.current = reconnectRef.current + 1
          const maxAttempts = (options && options.maxReconnectAttempts) || 10
          if (reconnectRef.current > maxAttempts) {
            setError(new Error('Max reconnect attempts reached'))
            return
          }

          // Exponential backoff + jitter
          const attempt = reconnectRef.current
          const base = reconnectInterval
          const expo = Math.min(30000, base * Math.pow(1.5, attempt))
          const jitter = Math.floor(Math.random() * Math.min(1000, expo * 0.3))
          const backoff = expo + jitter
          setTimeout(() => {
            if (!manuallyClosedRef.current) connect()
          }, backoff)
        }
      })

      socket.addEventListener('error', (e) => {
        // WebSocket error events are generic; capture for diagnostics
        setError(new Error('WebSocket error'))
      })
    } catch (e) {
      setError(e)
    }
  }, [buildUrl, token, autoReconnect, reconnectInterval])

  useEffect(() => {
    connect()
    return () => {
      try {
        wsRef.current?.close()
      } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect])

  const send = useCallback((data: any) => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false
      const payload = typeof data === 'string' ? data : JSON.stringify(data)
      wsRef.current.send(payload)
      return true
    } catch (e) {
      setError(e)
      return false
    }
  }, [])

  const close = useCallback(() => {
    try {
      wsRef.current?.close()
      wsRef.current = null
      setConnected(false)
    } catch (e) {
      setError(e)
    }
  }, [])

  return { connected, lastMessage, error, send, close }
}

export default useWebSocket
