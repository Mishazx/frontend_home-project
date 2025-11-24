import React, { useEffect, useState, useCallback } from 'react'
import { authService } from '../authService'
import useWebSocket from '../hooks/useWebSocket'
import ClientDetail from './ClientDetail'

type ClientInfo = {
  id: string
  hostname?: string
  ip?: string
  port?: number
  status?: string
  connected_at?: string
  last_heartbeat?: string
}

const AdminClients: React.FC = () => {
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = authService.getAuthHeaders()
      const res = await fetch(`/api/clients`, { headers: { ...headers } })
      if (!res.ok) throw new Error('Ошибка получения клиентов')
      const data = await res.json()
      setClients(data)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Подключаем WS для live-обновлений (указывает явный backend URL и токен)
    const { lastMessage, connected } = useWebSocket({
      // Подключаемся к admin WS, который отделён от агенского `/ws`.
      url: '/admin/ws',
    token: authService.getToken(),
    onMessage: (msg) => {
      // Примитивная обработка: ожидаем события с типом и данными
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'client_update' && msg.data) {
        const updated = msg.data as ClientInfo
        setClients((prev) => {
          const idx = prev.findIndex((c) => c.id === updated.id)
          if (idx === -1) return [updated, ...prev]
          const copy = [...prev]
          copy[idx] = { ...copy[idx], ...updated }
          return copy
        })
      }
      if (msg.type === 'client_list_refresh') {
        fetchClients()
      }
    },
  })

  return (
    <div style={{ textAlign: 'left', marginTop: 24 }}>
      <h3>Админ: Клиенты</h3>
      <div style={{ marginBottom: 8 }}>
        WS: {connected ? 'connected' : 'disconnected'} — <button onClick={fetchClients}>Обновить</button>
      </div>
      {loading && <div>Загрузка...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8 }}>ID</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Hostname</th>
            <th style={{ textAlign: 'left', padding: 8 }}>IP</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Last heartbeat</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} style={{ borderTop: '1px solid #eee', cursor: 'pointer' }} onClick={() => setSelectedClient(c.id)}>
              <td style={{ padding: 8 }}>{c.id}</td>
              <td style={{ padding: 8 }}>{c.hostname || '-'}</td>
              <td style={{ padding: 8 }}>{c.ip || '-'}:{c.port || '-'}</td>
              <td style={{ padding: 8 }}>{c.status || '-'}</td>
              <td style={{ padding: 8 }}>{c.last_heartbeat || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <strong>Последнее WS сообщение:</strong>
        <pre style={{ background: '#f6f8fa', padding: 8 }}>{JSON.stringify(lastMessage, null, 2)}</pre>
      </div>

      {selectedClient && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setSelectedClient(null)}>Назад к списку</button>
            <div style={{ marginTop: 8 }}>
              <ClientDetail clientId={selectedClient} onClose={() => setSelectedClient(null)} />
            </div>
        </div>
      )}
    </div>
  )
}

export default AdminClients
