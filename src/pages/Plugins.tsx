import React, { useEffect, useState } from 'react'
import { authService } from '../authService'

type PluginManifest = {
  name?: string
  version?: string
  description?: string
  actions?: Record<string, unknown>
}

const PluginsPage: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginManifest[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [gitUrl, setGitUrl] = useState<string>('')
  const [message, setMessage] = useState<string | null>(null)
  const [installing, setInstalling] = useState<boolean>(false)

  const loadPlugins = async () => {
    setLoading(true)
    try {
      const data = await authService.fetchJson('/api/plugins')
      if (Array.isArray(data)) setPlugins(data)
      else setPlugins([])
    } catch (err: unknown) {
      console.error('Failed to load plugins', err)
      const msg = typeof err === 'string' ? err : (err && (err as { message?: string }).message) ? (err as { message?: string }).message! : 'Ошибка загрузки'
      setMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlugins()
  }, [])

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!gitUrl || gitUrl.trim().length === 0) {
      setMessage('Укажите git URL')
      return
    }

    setInstalling(true)
    try {
      const body = JSON.stringify({ git_url: gitUrl })
      const res = await authService.fetchJson('/api/plugins/install', {
        method: 'POST',
        body,
      })

      setMessage('Установка инициирована: ' + (res?.status ?? JSON.stringify(res)))
      setGitUrl('')
      // обновим список после небольшой паузы
      setTimeout(loadPlugins, 800)
    } catch (err: unknown) {
      console.error('Install error', err)
      const msg = typeof err === 'string' ? err : (err && (err as { message?: string }).message) ? (err as { message?: string }).message! : 'Ошибка установки'
      setMessage(msg)
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div style={{ textAlign: 'left' }}>
      <h3>Плагины</h3>

      <section style={{ marginBottom: 20 }}>
        <form onSubmit={handleInstall} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Git URL плагина (например https://github.com/your/repo)"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
          />
          <button type="submit" disabled={installing} style={{ padding: '8px 12px', borderRadius: 6 }}>
            {installing ? 'Установка...' : 'Установить'}
          </button>
        </form>
        {message && <div style={{ marginTop: 8, color: '#333' }}>{message}</div>}
      </section>

      <section>
        <h4>Обнаруженные плагины</h4>
        {loading && <div>Загрузка...</div>}
        {!loading && plugins.length === 0 && <div>Плагины не найдены.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plugins.map((p, idx) => (
            <div key={idx} style={{ padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.name ?? 'unnamed'}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>{p.description ?? ''}</div>
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>{p.version ?? ''}</div>
              </div>

              {p.actions && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Действия:</div>
                  <ul>
                    {Object.keys(p.actions).map((a) => (
                      <li key={a} style={{ fontSize: 13 }}>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default PluginsPage
