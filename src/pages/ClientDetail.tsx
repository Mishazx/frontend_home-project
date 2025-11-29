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
  const [terminalInputText, setTerminalInputText] = useState('')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentTransferIdRef = useRef<string | null>(null)

  // Порог для автоматического выбора chunked upload (в байтах).
  // Переопределяется через Vite env `VITE_CHUNKED_THRESHOLD` (например 10485760 = 10 MiB).
  const CHUNKED_THRESHOLD = Number((import.meta as any).env?.VITE_CHUNKED_THRESHOLD) || 10 * 1024 * 1024

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
          <button
            onClick={async () => {
              try {
                const headers = { ...authService.getAuthHeaders() }
                const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/reset_encryption`, { method: 'POST', headers })
                if (!res.ok) throw new Error(`Error ${res.status}`)
                alert('Encryption state reset')
              } catch (err) {
                console.error('reset encryption failed', err)
                alert('Reset failed')
              }
            }}
            style={{ marginLeft: 8 }}
          >
            Reset Encryption
          </button>
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
        <div style={{ marginTop: 12 }}>
          <h5>Terminal (PoC)</h5>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={async () => {
                setError(null)
                try {
                  const headers = { 'Content-Type': 'application/json', ...authService.getAuthHeaders() }
                  const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/terminal/start`, { method: 'POST', headers })
                  if (!res.ok) throw new Error(`Error ${res.status}`)
                  const data = await res.json()
                  const sid = data.session_id
                  if (!sid) throw new Error('No session_id')
                  // open websocket and display simple output
                  // include token as query param because browsers don't allow custom headers for WebSocket
                  const token = authService.getToken()
                  // Server expects token in query param with 'Bearer ' prefix for this endpoint
                  const tokenParam = token ? `?token=${encodeURIComponent(`Bearer ${token}`)}` : ''
                  const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/terminal/${sid}${tokenParam}`
                  const ws = new WebSocket(wsUrl)
                  // prefer arraybuffer for binary payloads
                  try { ws.binaryType = 'arraybuffer' } catch (_) {}
                  ws.onopen = () => {
                    console.log('terminal ws open')
                    const el = document.getElementById('terminal_output') as HTMLTextAreaElement | null
                    if (el) el.value = el.value + '\n-- connected to terminal --\n'
                  }
                  ws.onmessage = async (ev) => {
                    let text: string | null = null
                    try {
                      if (typeof ev.data === 'string') {
                        text = ev.data
                      } else if (ev.data instanceof Blob) {
                        text = await ev.data.text()
                      } else if (ev.data instanceof ArrayBuffer) {
                        text = new TextDecoder().decode(ev.data)
                      } else {
                        // fallback
                        try {
                          text = String(ev.data)
                        } catch (e) {
                          text = null
                        }
                      }
                    } catch (e) {
                      console.error('Failed to decode ws message', e)
                    }
                    if (text !== null) {
                      const el = document.getElementById('terminal_output') as HTMLTextAreaElement | null
                      if (el) el.value = el.value + text
                    }
                  }
                  ws.onclose = () => console.log('terminal ws closed')
                  ws.onerror = (e) => console.error('terminal ws error', e)
                  // store ws on window for quick interaction (PoC)
                  ;(window as unknown as any).__terminal_ws = ws
                  alert('Terminal session started; simple PoC will append text to the page')
                } catch (err) {
                  console.error('terminal start failed', err)
                  setError(String(err))
                }
              }}
            >
              Open Terminal (PoC)
            </button>
            <button onClick={async () => {
              // download latest recording by asking core via API; user provides session id
              const sid = prompt('Enter session_id to download recording')
              if (!sid) return
              try {
                const headers = { ...authService.getAuthHeaders() }
                const res = await fetch(`/api/terminals/${sid}/recording`, { headers })
                if (!res.ok) throw new Error(`Download error ${res.status}`)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `terminal_${sid}.log`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch (e) {
                console.error('download recording failed', e)
                alert('Failed to download recording')
              }
            }}>Download recording (by session_id)</button>
          </div>
          <div style={{ marginTop: 8 }}>
            <textarea id="terminal_output" style={{ width: '100%', height: 240 }} readOnly />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                placeholder="Type and press Enter to send to terminal"
                value={terminalInputText}
                onChange={(e) => setTerminalInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    try {
                      const ws: any = (window as any).__terminal_ws
                      if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(terminalInputText + '\n')
                      }
                    } catch (err) {
                      console.error('send terminal input failed', err)
                    }
                    setTerminalInputText('')
                  }
                }}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => {
                  try {
                    const ws: any = (window as any).__terminal_ws
                    if (ws && ws.readyState === WebSocket.OPEN) {
                      ws.send(terminalInputText + '\n')
                    }
                  } catch (err) {
                    console.error('send terminal input failed', err)
                  }
                  setTerminalInputText('')
                }}
              >Send</button>
            </div>
          </div>
        </div>

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
                  // Автоматически выбираем chunked upload для больших файлов
                  if (fileToUpload.size > CHUNKED_THRESHOLD) {
                    // Используем PoC chunked upload
                    const transfer_id = await chunkedUpload(fileToUpload, clientId, uploadDest)
                    if (!transfer_id) throw new Error('Не удалось получить transfer_id')
                    setTransferStatus({ transfer_id, state: 'in_progress' })
                    startPolling(transfer_id)
                    return
                  }

                  // Мелкий файл: стандартный multipart POST к /api/files/upload/init
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
                  const transfer_id = data.transfer_id || data.transferId || data.transfer_id
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
                  // Запускаем chunked upload PoC
                  const transfer_id = await chunkedUpload(fileToUpload, clientId, uploadDest)
                  if (!transfer_id) throw new Error('Не удалось получить transfer_id')
                  setTransferStatus({ transfer_id, state: 'in_progress' })
                  startPolling(transfer_id)
                } catch (err) {
                  console.error('chunked upload error', err)
                  const ee = err as { message?: string }
                  setError(ee?.message || String(err))
                  setUploading(false)
                }
              }}
              style={{ marginLeft: 8 }}
            >
              Отправить файл на клиент (chunked)
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
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {transferStatus.state === 'in_progress' && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            const headers = { 'Content-Type': 'application/json', ...authService.getAuthHeaders() }
                            await fetch('/api/files/transfers/pause', { method: 'POST', headers, body: JSON.stringify({ transfer_id: transferStatus.transfer_id }) })
                          } catch (err) {
                            console.error('pause failed', err)
                          }
                        }}
                      >
                        Pause
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const headers = { 'Content-Type': 'application/json', ...authService.getAuthHeaders() }
                            await fetch('/api/files/transfers/resume', { method: 'POST', headers, body: JSON.stringify({ transfer_id: transferStatus.transfer_id }) })
                          } catch (err) {
                            console.error('resume failed', err)
                          }
                        }}
                      >
                        Resume
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const headers = { 'Content-Type': 'application/json', ...authService.getAuthHeaders() }
                            await fetch('/api/files/transfers/cancel', { method: 'POST', headers, body: JSON.stringify({ transfer_id: transferStatus.transfer_id }) })
                          } catch (err) {
                            console.error('cancel failed', err)
                          }
                        }}
                      >
                        Cancel
                      </button>
                    </>
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

async function chunkedUpload(file: File, clientId: string, path: string) {
  const chunkSize = 4 * 1024 * 1024 // 4 MiB
  const headers = authService.getAuthHeaders()
  const fingerprint = `${file.name}_${file.size}_${file.lastModified}_${clientId}_${path}`
  let transferId: string | null = localStorage.getItem(`upload_${fingerprint}`)

  // Если есть transferId — попытаться получить текущий received
  let received = 0
  if (transferId) {
    try {
      const st = await (await fetch(`/api/files/transfers/${transferId}/status`, { headers: { ...headers } })).json()
      received = st.received || 0
    } catch {
      received = 0
    }
  }

  while (received < file.size) {
    // Parallel upload workers: build list of chunk ranges and upload with concurrency
    const concurrency = 3
    const chunks: Array<{ start: number; end: number; index: number }> = []
    let cursor = received
    while (cursor < Math.min(file.size, received + chunkSize * 32)) {
      const s = cursor
      const e = Math.min(file.size, s + chunkSize)
      chunks.push({ start: s, end: e, index: s / chunkSize })
      cursor = e
    }

    // Ensure uploads map exists
    let ctrl: any
    if (typeof window !== 'undefined') {
      const w: any = window as any
      w.__uploads = w.__uploads || {}
      // control object for pause/cancel
      w.__uploads[fingerprint] = w.__uploads[fingerprint] || { paused: false, cancelled: false }
      ctrl = w.__uploads[fingerprint]
    } else {
      ctrl = { paused: false, cancelled: false }
    }

    const sendChunk = async (c: { start: number; end: number; index: number }) => {
      // respect pause/cancel
      while (ctrl.paused) {
        if (ctrl.cancelled) throw new Error('cancelled')
        await new Promise((r) => setTimeout(r, 300))
      }
      if (ctrl.cancelled) throw new Error('cancelled')
      const slice = file.slice(c.start, c.end)
      const form = new FormData()
      form.append('client_id', clientId)
      form.append('path', path)
      form.append('offset', String(c.start))
      form.append('file', slice)
      form.append('original_filename', file.name)
      if (transferId) form.append('transfer_id', transferId)

      const res = await fetch('/api/files/upload/chunk', { method: 'POST', body: form, headers: { ...headers } })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Upload chunk failed: ${res.status} ${txt}`)
      }
      const data = await res.json()
      transferId = data.transfer_id
      if (!transferId) throw new Error('Server did not return transfer_id')
      localStorage.setItem(`upload_${fingerprint}`, transferId)
      return data.received || (c.end - c.start)
    }

    // worker pool
    const pool: Promise<void>[] = []
    let idx = 0
    const runNext = async () => {
      if (idx >= chunks.length) return
      const c = chunks[idx++]!
      const r = await sendChunk(c)
      // update received if this chunk advanced cursor
      if (c.start + r > received) received = c.start + r
      return runNext()
    }

    for (let i = 0; i < concurrency && i < chunks.length; i++) {
      pool.push(runNext())
    }

    await Promise.all(pool)
  }

  // Complete
  if (!transferId) throw new Error('Missing transfer_id before complete')
  const formc = new FormData()
  formc.append('transfer_id', transferId)
  const rc = await fetch('/api/files/upload/complete', { method: 'POST', body: formc, headers: { ...headers } })
  if (!rc.ok) {
    const txt = await rc.text()
    throw new Error(`Complete failed: ${rc.status} ${txt}`)
  }
  // Cleanup local resume info
  localStorage.removeItem(`upload_${fingerprint}`)
  return transferId
}

export default ClientDetail
