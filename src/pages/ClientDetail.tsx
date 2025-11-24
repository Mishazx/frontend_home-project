import React, { useEffect, useState } from 'react'
import { authService } from '../authService'

type ClientInfo = {
  id: string
  hostname?: string
  ip?: string
  port?: number
  status?: string
  connected_at?: string
  last_heartbeat?: string
}

type Props = {
  clientId: string
  onClose?: () => void
}

const ClientDetail: React.FC<Props> = ({ clientId, onClose }) => {
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [command, setCommand] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchClient = async () => {
      setLoading(true)
      setError(null)
      try {
        const headers = authService.getAuthHeaders()
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, { headers: { ...headers } })
        if (!res.ok) throw new Error(`Не удалось получить клиента: ${res.status}`)
        const data = await res.json()
        setClient(data)
      } catch (e: any) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    }
    fetchClient()
  }, [clientId])

  const sendCommand = async (asyncExec = false) => {
    setResult(null)
    setError(null)
    if (!command || command.trim().length === 0) {
      setError('Введите команду')
      return
    }

    try {
      const headers = { 'Content-Type': 'application/json', ...authService.getAuthHeaders() }
      const endpoint = `/api/commands/${encodeURIComponent(clientId)}` + (asyncExec ? '/async' : '')
      const body = JSON.stringify({ command: command.trim() })
      const res = await fetch(endpoint, { method: 'POST', headers, body })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Ошибка ${res.status}: ${txt}`)
      }

      const data = await res.json()
      setResult(data)

      // Если асинхронно — отобразим command_id и ссылку на статус
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }

  return (
    <div style={{ textAlign: 'left', marginTop: 16, border: '1px solid #eee', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h4>Клиент: {clientId}</h4>
        <div>
          {onClose && (
            <button onClick={onClose} style={{ marginLeft: 8 }}>Закрыть</button>
          )}
        </div>
      </div>

      {loading && <div>Загрузка...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      {client && (
        <div>
          <div>Hostname: {client.hostname || '-'}</div>
          <div>IP: {client.ip || '-'}:{client.port || '-'}</div>
          <div>Status: {client.status || '-'}</div>
          <div>Last heartbeat: {client.last_heartbeat || '-'}</div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <textarea
          placeholder="Введите команду для выполнения на устройстве"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          style={{ width: '100%', minHeight: 80 }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => sendCommand(false)}>Отправить и ждать</button>
          <button onClick={() => sendCommand(true)}>Отправить асинхронно</button>
        </div>

        {result && (
          <div style={{ marginTop: 12 }}>
            <strong>Результат:</strong>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <button
                onClick={async () => {
                  try {
                    const toCopy = result && result.result !== undefined ? result.result : result
                    await navigator.clipboard.writeText(JSON.stringify(toCopy, null, 2))
                    alert('Скопировано в буфер обмена')
                  } catch (e) {
                    alert('Не удалось скопировать')
                  }
                }}
              >
                Скопировать
              </button>
              <button
                onClick={() => {
                  try {
                    const toSave = result && result.result !== undefined ? result.result : result
                    const blob = new Blob([typeof toSave === 'string' ? toSave : JSON.stringify(toSave, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `result_${clientId || 'unknown'}.json`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                  } catch (err) {
                    console.error('save result error', err)
                    alert('Не удалось сохранить файл')
                  }
                }}
              >
                Сохранить
              </button>
            </div>

            <pre
              style={{
                background: '#f6f8fa',
                padding: 8,
                color: '#111',
                whiteSpace: 'pre-wrap',
                marginTop: 8,
                borderRadius: 6,
                overflowX: 'auto',
              }}
            >
              {(() => {
                const toShow = result && result.result !== undefined ? result.result : result
                try {
                  return typeof toShow === 'string' ? toShow : JSON.stringify(toShow, null, 2)
                } catch (err) {
                  console.error('render result stringify error', err)
                  return String(toShow)
                }
              })()}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClientDetail
