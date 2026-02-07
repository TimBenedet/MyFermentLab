import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { BrewingProvider } from './context/BrewingContext'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { RecipesPage } from './pages/RecipesPage'
import { BrewModePage } from './pages/BrewModePage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ArchivesPage } from './pages/ArchivesPage'

export default function App() {
  return (
    <BrowserRouter>
      <BrewingProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/:recipeId/brew" element={<BrewModePage />} />
            <Route path="/project/:projectId" element={<ProjectDetailPage />} />
            <Route path="/archives" element={<ArchivesPage />} />
          </Routes>
        </AppLayout>
      </BrewingProvider>
    </BrowserRouter>
  )
}
