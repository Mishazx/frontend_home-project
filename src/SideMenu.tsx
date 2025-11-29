import React, { useState } from "react";
import { useNavigate } from 'react-router-dom'

type SideMenuProps = {
  user?: { username?: string } | null;
  onLogout?: () => void;
  onReconnect?: () => void;
  onNavigate?: (page: string) => void;
};

const SideMenu: React.FC<SideMenuProps> = ({ user, onLogout, onReconnect, onNavigate }) => {
  const [open, setOpen] = useState<boolean>(false);
  const navigate = useNavigate()

  const handleReconnect = () => {
    if (onReconnect) onReconnect();
    else return
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
    else return
  };

  return (
    <>
      {/* Кнопка-ткгл для показа/скрытия сайдбара */}
      <button
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 1000,
          padding: "8px 12px",
          borderRadius: 6,
        }}
      >
        {open ? "✕" : "☰"}
      </button>

      {/* Сайдбар */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: open ? 0 : -320,
          width: 320,
          height: "100vh",
          background: "#0f172a",
          color: "#e6eef8",
          boxShadow: "2px 0 8px rgba(0,0,0,0.3)",
          padding: 20,
          transition: "left 240ms ease",
          zIndex: 999,
        }}
      >
        <header style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Меню</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9fb0c8" }}>
            Вход и управление подключением
          </p>
        </header>

        <section style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Добро пожаловать</div>
            <div style={{ color: "#9fb0c8", marginTop: 6 }}>
              {user?.username ? user.username : "Гость"}
            </div>
          </div>

          <nav>
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={() => { onNavigate?.('home'); navigate('/') }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: '#0b1220',
                  color: '#cfe8ff',
                  border: '1px solid rgba(255,255,255,0.04)'
                }}
              >
                Главная
              </button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <details>
                <summary style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 6, listStyle: 'none' }}>Управление</summary>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => { onNavigate?.('clients'); navigate('/clients') }} style={{ padding: '8px', textAlign: 'left', borderRadius: 6, background: '#071028', color: '#dbeffd', border: 'none' }}>Remote клиенты</button>
                  <button onClick={() => { onNavigate?.('enrollments'); navigate('/enrollments') }} style={{ padding: '8px', textAlign: 'left', borderRadius: 6, background: '#071028', color: '#dbeffd', border: 'none' }}>Enrollments</button>
                  <button onClick={() => { onNavigate?.('plugins'); navigate('/plugins') }} style={{ padding: '8px', textAlign: 'left', borderRadius: 6, background: '#071028', color: '#dbeffd', border: 'none' }}>Плагины</button>
                  <button onClick={() => { onNavigate?.('yandex'); navigate('/yandex') }} style={{ padding: '8px', textAlign: 'left', borderRadius: 6, background: '#071028', color: '#dbeffd', border: 'none' }}>Yandex</button>
                  <button onClick={() => { onNavigate?.('registry'); navigate('/registry') }} style={{ padding: '8px', textAlign: 'left', borderRadius: 6, background: '#071028', color: '#dbeffd', border: 'none' }}>Registry</button>
                  <button onClick={() => { onNavigate?.('install_jobs'); navigate('/install-jobs') }} style={{ padding: '8px', textAlign: 'left', borderRadius: 6, background: '#071028', color: '#dbeffd', border: 'none' }}>Install Jobs</button>
                </div>
              </details>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                }}
              >
                Выйти
              </button>

              <button
                type="button"
                onClick={handleReconnect}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                }}
              >
                Переподключить
              </button>
            </div>
          </nav>
        </section>

        <footer style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <small style={{ color: "#8fa7c2" }}>Версия UI: 1.0.0</small>
        </footer>
      </aside>
    </>
  );
};

export default SideMenu;