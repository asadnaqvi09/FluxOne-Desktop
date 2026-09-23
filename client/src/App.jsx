import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { PosProvider } from '@/context/PosContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { store } from '@/rtk/store'
import { router } from '@/router'

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <PosProvider>
            <RouterProvider router={router} />
            {/* Below sticky h-14 header so toasts never cover nav (QA TC-Header view block) */}
            <Toaster
              position="top-right"
              richColors
              closeButton
              offset={{ top: '4.5rem' }}
            />
          </PosProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  )
}
