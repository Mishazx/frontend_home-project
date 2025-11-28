import React, { useEffect, useRef, useState } from 'react'
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
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const [uploadDest, setUploadDest] = useState<string>('')
    const [transferStatus, setTransferStatus] = useState<Record<string, any> | null>(null)
  const [uploading, setUploading] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentTransferIdRef = useRef<string | null>(null)

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    currentTransferIdRef.current = null
  }

  const startPolling = (transferId: string, onComplete?: (status: Record<string, unknown>) => Promise<void> | void) => {
    if (!transferId) return
    if (currentTransferIdRef.current === transferId && pollTimerRef.current) {
      return
    }
    stopPolling()
    currentTransferIdRef.current = transferId
    const poll = async () => {
      try {
        const headers = authService.getAuthHeaders()
        const st = await (await fetch(`/api/files/transfers/${transferId}/status`, { headers: { ...headers } })).json()
        setTransferStatus(st)
        if (st.state && st.state !== 'in_progress') {
          stopPolling()
          setUploading(false)
          if (onComplete) {
            await onComplete(st)
          }
        }
      } catch (err) {
        console.error('poll status error', err)
        stopPolling()
        setUploading(false)
      }
    }
    poll()
    pollTimerRef.current = setInterval(poll, 1500)
  }

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [])

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
        <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12 }}>
          <h5>Файлы</h5>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="file" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} />
            <input
              placeholder="Путь на клиенте (например /tmp/upload.bin)"
              value={uploadDest}
              onChange={(e) => setUploadDest(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              onClick={async () => {
                setError(null)
                if (!fileToUpload) {
                  setError('Выберите файл')
                  return
                }
                if (!uploadDest) {
                  setError('Укажите путь назначения на клиенте')
                  return
                }

                try {
                  setUploading(true)
                  const form = new FormData()
                  form.append('file', fileToUpload)
                  form.append('client_id', clientId)
                  form.append('path', uploadDest)
                  form.append('original_filename', fileToUpload.name)

                  const headers = { ...authService.getAuthHeaders() }
                  // Не указываем Content-Type, браузер сам установит boundary
                  const res = await fetch('/api/files/upload/init', { method: 'POST', headers, body: form })
                  if (!res.ok) {
                    const txt = await res.text()
                    throw new Error(`Ошибка ${res.status}: ${txt}`)
                  }
                  const data = await res.json()
                  const transfer_id = data.transfer_id || data.transferId || data.transferId || data.transfer_id
                  if (!transfer_id) {
                    setError('Не получили transfer_id')
                    setUploading(false)
                    return
                  }

                  // Поли́нг статуса
                  setTransferStatus({ transfer_id, state: 'in_progress' })
                  startPolling(transfer_id)
                } catch (err) {
                  console.error('upload error', err)
                  const ee = err as { message?: string }
                  setError(ee?.message || String(err))
                  setUploading(false)
                }
              }}
            >
              Отправить файл на клиент
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              placeholder="Путь на клиенте для скачивания (например /tmp/output.bin)"
              style={{ flex: 1 }}
              id="downloadPath"
            />
            <button
              onClick={async () => {
                const el = document.getElementById('downloadPath') as HTMLInputElement | null
                const srcPath = el?.value || ''
                setError(null)
                if (!srcPath) {
                  setError('Укажите путь на клиенте для скачивания')
                  return
                }
                try {
                  setUploading(true)
                  // Инициируем скачивание через core_service
                  const form = new FormData()
                  form.append('client_id', clientId)
                  form.append('path', srcPath)
                  const res = await fetch('/api/files/download', { method: 'POST', body: form, headers: { ...authService.getAuthHeaders() } })
                  if (!res.ok) {
                    const txt = await res.text()
                    throw new Error(`Ошибка ${res.status}: ${txt}`)
                  }
                  const data = await res.json()
                  const transfer_id = data.transfer_id
                  if (!transfer_id) throw new Error('Не получили transfer_id')

                  setTransferStatus({ transfer_id, state: 'in_progress' })
                  startPolling(transfer_id, async (st) => {
                    if (st.state === 'completed') {
                      const headers = { ...authService.getAuthHeaders() }
                      const dl = await fetch(`/api/files/download/${transfer_id}`, { headers })
                      if (!dl.ok) throw new Error(`Download error ${dl.status}`)
                      const blob = await dl.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      const name = srcPath.split('/').pop() || (st.original_filename as string) || `file_${transfer_id}`
                      a.download = name
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                    }
                  })
                } catch (err) {
                  console.error('download init error', err)
                  setError(String(err))
                  setUploading(false)
                }
              }}
            >
              Скачать с клиента
            </button>
          </div>

          {uploading && transferStatus && (
            <div style={{ marginTop: 8, padding: 12, background: '#f6f8fa', borderRadius: 6, border: '1px solid #e1e4e8' }}>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>Передача файла</strong>
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>Направление:</strong> {transferStatus.direction === 'upload' ? '📤 Отправка на клиент' : '📥 Скачивание с клиента'}
              </div>
              {transferStatus.client_id && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Клиент:</strong> {String(transferStatus.client_id)}
                </div>
              )}
              {transferStatus.direction === 'upload' && transferStatus.path && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Путь на клиенте:</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: 3 }}>{String(transferStatus.path)}</code>
                </div>
              )}
              {transferStatus.direction === 'upload' && transferStatus.original_filename && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Исходное имя файла:</strong>{' '}
                  <code style={{ background: '#fff', padding: '2px 4px', borderRadius: 3 }}>{String(transferStatus.original_filename)}</code>
                </div>
              )}
              {transferStatus.direction === 'upload' && transferStatus.source_path_server && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Источник (сервер):</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: 3 }}>{String(transferStatus.source_path_server)}</code>
                </div>
              )}
              {transferStatus.direction === 'download' && transferStatus.path && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Путь на клиенте:</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: 3 }}>{String(transferStatus.path)}</code>
                </div>
              )}
              {transferStatus.direction === 'download' && transferStatus.dest_path && (
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Сохранение (сервер):</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: 3 }}>{String(transferStatus.dest_path)}</code>
                </div>
              )}
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>Статус:</strong> <span style={{ 
                  color: transferStatus.state === 'completed' ? '#28a745' : 
                         transferStatus.state === 'failed' ? '#dc3545' : 
                         transferStatus.state === 'paused' ? '#ffc107' : '#007bff',
                  fontWeight: 'bold'
                }}>{String(transferStatus.state ?? 'unknown')}</span>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                <strong>ID передачи:</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: 3, fontSize: 11 }}>{String(transferStatus?.transfer_id ?? '')}</code>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 12, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                  {typeof transferStatus?.size === 'number' && (
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.round(((transferStatus.received as number) || 0) * 100 / (transferStatus.size as number))) }%`,
                        background: transferStatus.state === 'completed' ? '#28a745' : 
                                   transferStatus.state === 'failed' ? '#dc3545' : '#4f46e5',
                        transition: 'width 300ms ease'
                      }}
                    />
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  {Number((transferStatus && (transferStatus.received as number)) || 0).toLocaleString()} / {typeof transferStatus?.size === 'number' ? transferStatus.size.toLocaleString() : 'unknown'} bytes
                  {typeof transferStatus?.size === 'number' && transferStatus.size > 0 && (
                    <span style={{ marginLeft: 8 }}>
                      ({Math.round(((transferStatus.received as number) || 0) * 100 / transferStatus.size)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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
                  } catch (err) {
                    console.warn('copy failed', err)
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
