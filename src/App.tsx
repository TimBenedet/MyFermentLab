import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConnectionProvider } from './context/ConnectionContext'
import { BrewingProvider } from './context/BrewingContext'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ArchivesPage } from './pages/ArchivesPage'
import { LoginPage } from './pages/LoginPage'
import { DevicesPage } from './pages/DevicesPage'
import { CreateProjectPage } from './pages/CreateProjectPage'

export default function App() {
  return (
    <BrowserRouter>
      <ConnectionProvider>
        <BrewingProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/project/:projectId" element={<ProjectDetailPage />} />
              <Route path="/archives" element={<ArchivesPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/create" element={<CreateProjectPage />} />
            </Route>
          </Routes>
        </BrewingProvider>
      </ConnectionProvider>
    </BrowserRouter>
  )
}
