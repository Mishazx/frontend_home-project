import React, { useEffect, useState } from 'react'
import { authService } from '../authService'

type Device = {
  id: string
  name?: string
  type?: string
}

const YandexPage: React.FC = () => {
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [bindDeviceId, setBindDeviceId] = useState<string | null>(null)
  const [resourceId, setResourceId] = useState<string>('')

  const loadAuthUrl = async () => {
    try {
      const res = await authService.fetchJson('/api/plugins/yandex/start_oauth')
      setAuthUrl(res?.auth_url ?? null)
    } catch (e: unknown) {
      console.error(e)
      setMessage('Не удалось получить OAuth URL')
    }
  }

  const openAuth = async () => {
    if (!authUrl) {
      await loadAuthUrl()
      if (!authUrl) return
    }
    window.open(authUrl!, '_blank')
  }

  const loadDevices = async () => {
    setLoading(true)
    try {
      const res = await authService.fetchJson('/api/plugins/yandex/devices')
      setDevices(res?.devices || [])
    } catch (e) {
      console.error(e)
      setMessage('Ошибка загрузки устройств')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuthUrl()
    loadDevices()
  }, [])

  const handleBind = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!bindDeviceId) {
      setMessage('Выберите устройство для бинда')
      return
    }
    if (!resourceId) {
      setMessage('Укажите resource_id')
      return
    }
    try {
      const body = JSON.stringify({ device_id: bindDeviceId, resource_id: resourceId })
      await authService.fetchJson('/api/plugins/yandex/bind', { method: 'POST', body })
      setMessage('Привязка сохранена')
      setResourceId('')
    } catch (err) {
      console.error(err)
      setMessage('Ошибка при сохранении привязки')
    }
  }

  return (
    <div style={{ textAlign: 'left' }}>
      <h3>Yandex Smart Home</h3>

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={openAuth} style={{ padding: '8px 12px', borderRadius: 6 }}>Подключить аккаунт Yandex</button>
          <button onClick={loadDevices} style={{ padding: '8px 12px', borderRadius: 6 }}>Обновить устройства</button>
        </div>
        {message && <div style={{ marginTop: 8 }}>{message}</div>}
      </section>

      <section>
        <h4>Устройства (обнаруженные)</h4>
        {loading && <div>Загрузка...</div>}
        {!loading && devices.length === 0 && <div>Устройств не найдено.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {devices.map((d) => (
            <div key={d.id} style={{ padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{d.name || d.id}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{d.type}</div>
                </div>
                <div>
                  <button onClick={() => setBindDeviceId(d.id)} style={{ marginRight: 8 }}>Выбрать</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h4>Создать привязку</h4>
        <form onSubmit={handleBind} style={{ display: 'flex', gap: 8 }}>
          <select value={bindDeviceId ?? ''} onChange={(e) => setBindDeviceId(e.target.value)} style={{ padding: 8 }}>
            <option value="">-- Выберите устройство --</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
          </select>
          <input placeholder="resource_id (локальный идентификатор)" value={resourceId} onChange={(e) => setResourceId(e.target.value)} style={{ padding: 8, flex: 1 }} />
          <button type="submit" style={{ padding: '8px 12px' }}>Сохранить</button>
        </form>
      </section>
    </div>
  )
}

export default YandexPage
