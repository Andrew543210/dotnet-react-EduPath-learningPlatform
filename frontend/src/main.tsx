import '@fontsource-variable/onest'
import '@fontsource-variable/jetbrains-mono'
import './styles/global.css'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Providers } from './app/Providers'
import { createRouter } from './app/router'

function App() {
  const [router] = useState(createRouter)
  return <RouterProvider router={router} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
