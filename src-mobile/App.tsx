import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Project, Device, FERMENTATION_TYPES } from '../src/types';
import { apiService } from '../src/services/api.service';
import { HomePage } from './pages/HomePage';
import { MonitoringPage } from './pages/MonitoringPage';
import { DevicesPage } from './pages/DevicesPage';
import { LoginPage } from './pages/LoginPage';

type Page = 'home' | 'monitoring' | 'devices';

function AppContent() {
  const { isAuthenticated, role, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, devicesData] = await Promise.all([
        apiService.getProjects(),
        apiService.getDevices()
      ]);
      setProjects(projectsData.filter(p => !p.archived));
      setDevices(devicesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = async (project: Project) => {
    try {
      const fullProject = await apiService.getProject(project.id);
      setSelectedProject(fullProject);
      setCurrentPage('monitoring');
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const handleToggleOutlet = async (projectId: string) => {
    try {
      const updated = await apiService.toggleOutlet(projectId);
      setSelectedProject(prev => prev ? { ...prev, outletActive: updated.outletActive } : null);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, outletActive: updated.outletActive } : p));
    } catch (error) {
      console.error('Failed to toggle outlet:', error);
    }
  };

  const handleUpdateTarget = async (projectId: string, target: number) => {
    try {
      const updated = await apiService.updateProjectTarget(projectId, target);
      setSelectedProject(prev => prev ? { ...prev, targetTemperature: updated.targetTemperature } : null);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, targetTemperature: updated.targetTemperature } : p));
    } catch (error) {
      console.error('Failed to update target:', error);
    }
  };

  const handleToggleMode = async (projectId: string) => {
    try {
      const updated = await apiService.toggleControlMode(projectId);
      setSelectedProject(prev => prev ? { ...prev, controlMode: updated.controlMode } : null);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, controlMode: updated.controlMode } : p));
    } catch (error) {
      console.error('Failed to toggle mode:', error);
    }
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (loading) {
    return (
      <div className="mobile-loading">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="mobile-app">
      {/* Header */}
      <header className="mobile-header">
        <div className="header-left">
          {currentPage !== 'home' && (
            <button className="back-btn" onClick={() => {
              setCurrentPage('home');
              setSelectedProject(null);
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
          )}
        </div>
        <div className="header-title">
          <span className="logo-icon">🧪</span>
          <span>MyFermentLab</span>
        </div>
        <div className="header-right">
          <button className="menu-btn" onClick={logout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-main">
        {currentPage === 'home' && (
          <HomePage
            projects={projects}
            onSelectProject={handleSelectProject}
            onNavigateDevices={() => setCurrentPage('devices')}
            onRefresh={loadData}
          />
        )}
        {currentPage === 'monitoring' && selectedProject && (
          <MonitoringPage
            project={selectedProject}
            devices={devices}
            onToggleOutlet={() => handleToggleOutlet(selectedProject.id)}
            onUpdateTarget={(target) => handleUpdateTarget(selectedProject.id, target)}
            onToggleMode={() => handleToggleMode(selectedProject.id)}
            onRefresh={async () => {
              const updated = await apiService.getProject(selectedProject.id);
              setSelectedProject(updated);
            }}
            role={role}
          />
        )}
        {currentPage === 'devices' && (
          <DevicesPage
            devices={devices}
            onBack={() => setCurrentPage('home')}
            role={role}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="mobile-nav">
        <button
          className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
          onClick={() => { setCurrentPage('home'); setSelectedProject(null); }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Accueil</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'devices' ? 'active' : ''}`}
          onClick={() => setCurrentPage('devices')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <line x1="9" y1="1" x2="9" y2="4"/>
            <line x1="15" y1="1" x2="15" y2="4"/>
            <line x1="9" y1="20" x2="9" y2="23"/>
            <line x1="15" y1="20" x2="15" y2="23"/>
          </svg>
          <span>Appareils</span>
        </button>
      </nav>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
