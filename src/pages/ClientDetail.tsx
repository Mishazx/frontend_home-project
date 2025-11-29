import React, { useEffect, useState } from 'react'
import { authService } from '../authService'
import TerminalPanel from '../components/TerminalPanel'
import { useParams, useNavigate } from 'react-router-dom'

type ClientInfo = {
  id: string
  hostname?: string
  ip?: string
  port?: number
  status?: string
  last_heartbeat?: string
}

type Props = {
  clientId?: string
  onClose?: () => void
}

const ClientDetail: React.FC<Props> = ({ clientId: propClientId, onClose }) => {
  const params = useParams()
  const navigate = useNavigate()
  const clientId = propClientId || params.clientId || ''
  const routeMode = !onClose && !!params.clientId

  const [client, setClient] = useState<ClientInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [command, setCommand] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!clientId) return
    let mounted = true
    const fetchClient = async () => {
      setLoading(true)
      try {
        const data = await authService.fetchJson(`/api/clients/${encodeURIComponent(clientId)}`)
        if (mounted) setClient(data)
      } catch (err) {
        console.error('fetch client error', err)
        if (mounted) setError(String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchClient()
    return () => { mounted = false }
  }, [clientId])

  const sendCommand = async (asyncExec = false) => {
    setResult(null)
    setError(null)
    if (!command.trim()) {
      setError('Введите команду')
      return
    }
    try {
      const endpoint = `/api/commands/${encodeURIComponent(clientId)}` + (asyncExec ? '/async' : '')
      const data = await authService.fetchJson(endpoint, { method: 'POST', body: JSON.stringify({ command: command.trim() }) })
      setResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    } catch (err) {
      setError(String(err))
    }
  }

  const doUpload = async () => {
    if (!fileToUpload) { setError('Выберите файл'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', fileToUpload)
      form.append('client_id', clientId)
      const data = await authService.fetchJson('/api/files/upload/init', { method: 'POST', body: form })
      console.log('upload init', data)
      alert('Upload started')
    } catch (err) {
      console.error('upload error', err)
      setError(String(err))
    } finally {
      setUploading(false)
    }
  }

  const container = (
    <div style={{ textAlign: 'left', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h4>Клиент: {clientId}</h4>
        <div>
          {onClose && <button onClick={onClose}>Закрыть</button>}
          {!onClose && routeMode && <button onClick={() => navigate('/clients')}>Назад</button>}
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
        <h5>Terminal</h5>
        <div style={{ marginTop: 8 }}>
          <React.Suspense fallback={<div>Loading terminal...</div>}>
            <TerminalPanel clientId={clientId} />
          </React.Suspense>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h5>Файлы</h5>
        <input type="file" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} />
        <div style={{ marginTop: 8 }}>
          <button onClick={doUpload} disabled={uploading}>{uploading ? 'Загрузка...' : 'Отправить файл'}</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <textarea placeholder="Введите команду" value={command} onChange={(e) => setCommand(e.target.value)} style={{ width: '100%', minHeight: 80 }} />
        <div style={{ marginTop: 8 }}>
          <button onClick={() => sendCommand(false)}>Отправить и ждать</button>
          <button onClick={() => sendCommand(true)} style={{ marginLeft: 8 }}>Отправить асинхронно</button>
        </div>
      </div>

      {result && (
        <pre style={{ background: '#f6f8fa', padding: 8, marginTop: 12 }}>{result}</pre>
      )}
    </div>
  )

  if (routeMode) {
    return (
      <div>
        <div onClick={() => navigate(-1)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 999 }} />
        <aside style={{ position: 'fixed', top: 40, right: 0, width: 520, height: 'calc(100vh - 80px)', background: '#fff', padding: 16, boxShadow: '-8px 0 24px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'auto' }}>
          {container}
        </aside>
      </div>
    )
  }

  return container
}

async function chunkedUpload(file: File, clientId: string, path: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('client_id', clientId)
  form.append('path', path)
  const data = await authService.fetchJson('/api/files/upload/init', { method: 'POST', body: form })
  return data.transfer_id || null
}

export default ClientDetail