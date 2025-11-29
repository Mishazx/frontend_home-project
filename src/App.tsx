import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import styled from 'styled-components'
import Login from './Login'
import SideMenu from './SideMenu'
import AdminClients from './pages/AdminClients'
import Home from './pages/Home'
import Plugins from './pages/Plugins'
import Registry from './pages/Registry'
import InstallJob from './pages/InstallJob'
import InstallJobsList from './pages/InstallJobsList'
import ClientDetail from './pages/ClientDetail'
import { useParams } from 'react-router-dom'

function ClientDetailWrapper() {
  const params = useParams()
  const clientId = params.clientId || ''
  return <ClientDetail clientId={clientId} />
}
import Yandex from './pages/Yandex'
import { authService } from './authService'
import type { User } from './authService'
import { Routes, Route } from 'react-router-dom'

const AppContainer = styled.div`
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
`

const AppHeader = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 0 0 0 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`

const UserText = styled.span`
  color: #333;
  font-weight: 500;
`

const LogoutButton = styled.button`
  padding: 0.5rem 1rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background: #c82333;
  }
`

const LogosContainer = styled.div``

const LogoLink = styled.a``

const Logo = styled.img`
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;

  &:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }

  &.react:hover {
    filter: drop-shadow(0 0 2em #61dafbaa);
  }
`

const ReactLogo = styled(Logo)`
  @keyframes logo-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    animation: logo-spin infinite 20s linear;
  }
`

const Title = styled.h1`
  font-size: 1.8em;
  line-height: 1.2;
`

const Card = styled.div`
  padding: 2em;
`

const CounterButton = styled.button`
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;

  &:hover {
    border-color: #646cff;
  }

  &:focus,
  &:focus-visible {
    outline: 4px auto -webkit-focus-ring-color;
  }
`

const Description = styled.p``

const Code = styled.code``

const ReadTheDocs = styled.p`
  color: #888;
`

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // routing handled by react-router

  // Проверяем токен при загрузке приложения
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authService.validateToken()
        if (user) {
          setUser(user)
          setIsAuthenticated(true)
        }
      } catch (error) {
        console.error('Auth validation error:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleLogin = (user: User) => {
    setIsAuthenticated(true)
    setUser(user)
  }

  const handleReconnect = () => {
    // Простая реализация переподключения: повторно проверим токен
    authService.validateToken().then((u) => {
      if (u) {
        setUser(u)
        setIsAuthenticated(true)
      } else {
        window.location.reload()
      }
    })
  }

  const handleLogout = () => {
    authService.logout()
    setIsAuthenticated(false)
    setUser(null)
  }

  // убрал переключатель видимости админки — всегда показываем админ

  if (loading) {
    return (
      <AppContainer>
        <div>Загрузка...</div>
      </AppContainer>
    )
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <AppContainer>
      <SideMenu user={user} onLogout={handleLogout} onReconnect={handleReconnect} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        <Title>Admin Panel</Title>
      </div>

      <div style={{ marginTop: 20 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/clients" element={<AdminClients />} />
          <Route path="/clients/:clientId" element={<ClientDetailWrapper />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/registry" element={<Registry />} />
          <Route path="/install-jobs" element={<InstallJobsList />} />
          <Route path="/install-jobs/:jobId" element={<InstallJob />} />
          <Route path="/yandex" element={<Yandex />} />
          <Route
            path="/enrollments"
            element={(
              <div style={{ textAlign: 'left' }}>
                <h3>Enrollments</h3>
                <p>Здесь будет список ожидающих заявок на подключение (enrollments).</p>
              </div>
            )}
          />
        </Routes>
      </div>
    </AppContainer>
  )
}

export default App
