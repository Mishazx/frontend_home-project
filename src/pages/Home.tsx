import React from 'react'

const Home: React.FC = () => {
  return (
    <div style={{ textAlign: 'left', marginTop: 24 }}>
      <h3>Главная</h3>
      <p>Добро пожаловать в админ-панель Remote Client Manager.</p>
      <ul>
        <li>Перейдите в «Управление → Remote клиенты», чтобы просмотреть и управлять подключенными агентами.</li>
        <li>Используйте кнопку «Переподключить» в меню, чтобы обновить сессию.</li>
      </ul>
    </div>
  )
}

export default Home
