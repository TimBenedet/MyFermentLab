import { useState, useEffect, useMemo } from 'react';
import { HomePage } from './pages/HomePage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { BrewingSessionPage } from './pages/BrewingSessionPage';
import { DevicesPage } from './pages/DevicesPage';
import { LoginPage } from './pages/LoginPage';
import { SummaryPage } from './pages/SummaryPage';
import { LabelGeneratorPage } from './pages/LabelGeneratorPage';
import { StatsPage } from './pages/StatsPage';
import { HealthCheckPage } from './pages/HealthCheckPage';
import { Project, Device, FermentationType, BrewingSession, BrewingRecipe } from './types';
import { apiService, ProjectWithHistory } from './services/api.service';
import { useAuth } from './contexts/AuthContext';
import './App.css';

type Page = 'home' | 'create-project' | 'monitoring' | 'brewing-session' | 'devices' | 'summary' | 'labels' | 'stats' | 'health';

function App() {
  const { isAuthenticated, role, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showHealthFromLogin, setShowHealthFromLogin] = useState(false);

  // États
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectWithHistory | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les projets et appareils au démarrage
  useEffect(() => {
    loadInitialData();
  }, []);

  // Charger le projet sélectionné avec son historique
  useEffect(() => {
    if (selectedProjectId) {
      loadProject(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Rafraîchir les données toutes les 10 secondes si on est sur la page de monitoring
  useEffect(() => {
    if (currentPage === 'monitoring' && selectedProjectId) {
      const interval = setInterval(() => {
        loadProject(selectedProjectId);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [currentPage, selectedProjectId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [projectsData, devicesData] = await Promise.all([
        apiService.getProjects(),
        apiService.getDevices()
      ]);
      setProjects(projectsData);
      setDevices(devicesData);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Impossible de charger les données. Vérifiez que le backend est accessible.');
    } finally {
      setLoading(false);
    }
  };

  const loadProject = async (projectId: string) => {
    try {
      const projectData = await apiService.getProject(projectId);
      setSelectedProject(projectData);

      // Mettre à jour aussi dans la liste des projets
      setProjects(prev => prev.map(p =>
        p.id === projectId ? projectData : p
      ));
    } catch (err) {
      console.error('Failed to load project:', err);
      setError('Impossible de charger le projet');
    }
  };

  // Gestion des projets
  const handleCreateProject = async (data: {
    name: string;
    fermentationType: FermentationType;
    sensorId: string;
    outletId: string;
    targetTemperature: number;
    controlMode: 'manual' | 'automatic';
    recipe?: BrewingRecipe;
  }, startBrewing?: boolean) => {
    try {
      console.log('Creating project with data:', JSON.stringify(data, null, 2));
      console.log('Recipe included:', !!data.recipe);
      if (data.recipe) {
        console.log('Recipe grains:', data.recipe.grains?.length || 0);
        console.log('Recipe hops:', data.recipe.hops?.length || 0);
      }
      const newProject = await apiService.createProject(data);
      console.log('Project created, recipe in response:', !!newProject.recipe);
      setProjects(prev => [...prev, newProject]);
      setSelectedProjectId(newProject.id);

      // Si on démarre le brassage, aller sur la page de session de brassage
      if (startBrewing && data.fermentationType === 'beer') {
        setCurrentPage('brewing-session');
      } else {
        setCurrentPage('home');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Impossible de créer le projet');
    }
  };

  const handleSelectProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    setSelectedProjectId(projectId);

    // Déterminer la page selon l'état du projet
    if (project?.fermentationType === 'beer') {
      // Si le brassage a une session mais n'est pas terminé
      if (project.brewingSession && !project.brewingSession.completedAt) {
        setCurrentPage('brewing-session');
      } else {
        setCurrentPage('monitoring');
      }
    } else {
      setCurrentPage('monitoring');
    }
  };

  const handleStartBrewing = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentPage('brewing-session');
  };

  const handleViewSummary = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentPage('summary');
  };

  const handleUpdateTarget = async (temp: number) => {
    if (!selectedProjectId) return;

    try {
      const updatedProject = await apiService.updateProjectTarget(selectedProjectId, temp);
      setSelectedProject(prev => prev ? { ...prev, targetTemperature: temp } : null);
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectId ? updatedProject : p
      ));
    } catch (err) {
      console.error('Failed to update target:', err);
      setError('Impossible de mettre à jour la température cible');
    }
  };

  const handleToggleOutlet = async () => {
    if (!selectedProjectId) return;

    try {
      const updatedProject = await apiService.toggleOutlet(selectedProjectId);
      setSelectedProject(prev => prev ? { ...prev, outletActive: updatedProject.outletActive } : null);
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectId ? updatedProject : p
      ));
    } catch (err) {
      console.error('Failed to toggle outlet:', err);
      setError('Impossible de contrôler la prise');
    }
  };

  const handleAddDensity = async (density: number, timestamp: number) => {
    if (!selectedProjectId) return;

    try {
      await apiService.addDensity(selectedProjectId, density, timestamp);
      // Recharger le projet pour obtenir l'historique mis à jour
      await loadProject(selectedProjectId);
    } catch (err) {
      console.error('Failed to add density:', err);
      setError('Impossible d\'ajouter la mesure de densité');
    }
  };

  const handleAddHumidity = async (humidity: number, timestamp: number) => {
    if (!selectedProjectId) return;

    try {
      await apiService.addHumidity(selectedProjectId, humidity, timestamp);
      // Recharger le projet pour obtenir l'historique mis à jour
      await loadProject(selectedProjectId);
    } catch (err) {
      console.error('Failed to add humidity:', err);
      setError('Impossible d\'ajouter la mesure d\'humidité');
    }
  };

  const handleToggleControlMode = async () => {
    if (!selectedProjectId) return;

    try {
      const updatedProject = await apiService.toggleControlMode(selectedProjectId);
      setSelectedProject(prev => prev ? { ...prev, controlMode: updatedProject.controlMode } : null);
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectId ? updatedProject : p
      ));
    } catch (err) {
      console.error('Failed to toggle control mode:', err);
      setError('Impossible de changer le mode de contrôle');
    }
  };

  const handleUpdateProject = async (projectId: string, data: {
    name?: string;
    fermentationType?: FermentationType;
    sensorId?: string;
    outletId?: string;
  }) => {
    try {
      const updatedProject = await apiService.updateProject(projectId, data);
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, ...updatedProject } : p
      ));
      if (selectedProjectId === projectId && selectedProject) {
        setSelectedProject(prev => prev ? { ...prev, ...updatedProject } : null);
      }
    } catch (err) {
      console.error('Failed to update project:', err);
      throw err; // Re-throw pour que le modal puisse afficher l'erreur
    }
  };

  // Session de brassage
  const handleUpdateBrewingSession = async (session: BrewingSession) => {
    if (!selectedProjectId || !selectedProject) return;

    try {
      const updatedProject = { ...selectedProject, brewingSession: session };
      await apiService.updateProject(selectedProjectId, { brewingSession: session });

      setSelectedProject(updatedProject);
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectId ? { ...p, brewingSession: session } : p
      ));
    } catch (err) {
      console.error('Failed to update brewing session:', err);
      setError('Impossible de mettre à jour la session de brassage');
    }
  };

  const handleFinishBrewing = async () => {
    if (!selectedProjectId || !selectedProject?.brewingSession) return;

    try {
      const completedSession = {
        ...selectedProject.brewingSession,
        completedAt: Date.now()
      };

      await apiService.updateProject(selectedProjectId, { brewingSession: completedSession });

      setSelectedProject(prev => prev ? { ...prev, brewingSession: completedSession } : null);
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectId ? { ...p, brewingSession: completedSession } : p
      ));

      // Aller sur la page de monitoring
      setCurrentPage('monitoring');
    } catch (err) {
      console.error('Failed to finish brewing:', err);
      setError('Impossible de terminer le brassage');
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    try {
      const updatedProject = await apiService.archiveProject(projectId);
      setProjects(prev => prev.map(p =>
        p.id === projectId ? updatedProject : p
      ));
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
        setSelectedProject(null);
        setCurrentPage('home');
      }
    } catch (err) {
      console.error('Failed to archive project:', err);
      setError('Impossible d\'archiver le projet');
    }
  };

  const handleUnarchiveProject = async (projectId: string) => {
    try {
      const updatedProject = await apiService.unarchiveProject(projectId);
      setProjects(prev => prev.map(p =>
        p.id === projectId ? updatedProject : p
      ));
    } catch (err: any) {
      console.error('Failed to unarchive project:', err);
      setError(err.message || 'Impossible de désarchiver le projet');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await apiService.deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
        setSelectedProject(null);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Impossible de supprimer le projet');
    }
  };

  // Gestion des appareils
  const handleAddDevice = async (device: Omit<Device, 'id'>) => {
    try {
      const newDevice = await apiService.createDevice(device);
      setDevices(prev => [...prev, newDevice]);
    } catch (err) {
      console.error('Failed to add device:', err);
      setError('Impossible d\'ajouter l\'appareil');
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await apiService.deleteDevice(deviceId);
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch (err) {
      console.error('Failed to delete device:', err);
      setError('Impossible de supprimer l\'appareil');
    }
  };

  // Calculer les IDs des devices déjà utilisés par des projets actifs
  const usedDeviceIds = useMemo(() => {
    const activeProjects = projects.filter(p => !p.archived);
    const ids: string[] = [];
    activeProjects.forEach(p => {
      if (p.sensorId) ids.push(p.sensorId);
      if (p.outletId) ids.push(p.outletId);
    });
    return ids;
  }, [projects]);

  // Show login page if not authenticated
  if (!isAuthenticated) {
    if (showHealthFromLogin) {
      return (
        <HealthCheckPage
          onBack={() => setShowHealthFromLogin(false)}
        />
      );
    }
    return <LoginPage onViewHealth={() => setShowHealthFromLogin(true)} />;
  }

  // Afficher une erreur si le backend n'est pas accessible
  if (loading && projects.length === 0) {
    return (
      <div className="app">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="app">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2 style={{ color: '#EF4444' }}>Erreur de connexion</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadInitialData} style={{ marginTop: '10px' }}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Moniteur de Fermentation</h1>
            <p className="app-subtitle">Contrôle et surveillance en temps réel</p>
          </div>
          <div className="header-actions">
            <span className="role-badge">
              {role === 'admin' ? 'Mode Admin' : 'Mode Lecture'}
            </span>
            {currentPage !== 'home' && (
              <button
                className="btn-secondary"
                onClick={() => setCurrentPage('home')}
              >
                ← Accueil
              </button>
            )}
            {currentPage === 'home' && (
              <button
                className="logout-btn"
                onClick={logout}
              >
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </header>

      {error && currentPage !== 'home' && (
        <div style={{
          padding: '10px',
          background: '#EF4444',
          color: 'white',
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: '10px',
              background: 'transparent',
              border: '1px solid white',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <main className="app-main">
        {currentPage === 'home' && (
          <HomePage
            projects={projects}
            devices={devices}
            onCreateProject={() => setCurrentPage('create-project')}
            onSelectProject={handleSelectProject}
            onViewSummary={handleViewSummary}
            onViewBrewingJournal={handleViewSummary}
            onArchiveProject={handleArchiveProject}
            onUnarchiveProject={handleUnarchiveProject}
            onDeleteProject={handleDeleteProject}
            onStartBrewing={handleStartBrewing}
            onUpdateProject={handleUpdateProject}
            onManageDevices={() => setCurrentPage('devices')}
            onLabelGenerator={() => setCurrentPage('labels')}
            onViewStats={() => setCurrentPage('stats')}
            onViewHealth={() => setCurrentPage('health')}
            role={role}
          />
        )}

        {currentPage === 'create-project' && (
          <CreateProjectPage
            devices={devices}
            usedDeviceIds={usedDeviceIds}
            onCreateProject={handleCreateProject}
            onCancel={() => setCurrentPage('home')}
            role={role}
          />
        )}

        {currentPage === 'monitoring' && selectedProject && (
          <MonitoringPage
            project={selectedProject}
            onUpdateTarget={handleUpdateTarget}
            onToggleOutlet={handleToggleOutlet}
            onAddDensity={handleAddDensity}
            onAddHumidity={handleAddHumidity}
            onToggleControlMode={handleToggleControlMode}
            onRefreshTemperature={() => selectedProjectId && loadProject(selectedProjectId)}
            onBack={() => setCurrentPage('home')}
            role={role}
          />
        )}

        {currentPage === 'brewing-session' && selectedProject && (
          <BrewingSessionPage
            project={selectedProject}
            onUpdateSession={handleUpdateBrewingSession}
            onFinishBrewing={handleFinishBrewing}
            onBack={() => setCurrentPage('home')}
          />
        )}

        {currentPage === 'summary' && selectedProjectId && (
          <SummaryPage
            projectId={selectedProjectId}
            onBack={() => {
              setSelectedProjectId(null);
              setCurrentPage('home');
            }}
          />
        )}

        {currentPage === 'devices' && (
          <DevicesPage
            devices={devices}
            onAddDevice={handleAddDevice}
            onDeleteDevice={handleDeleteDevice}
            onBack={() => setCurrentPage('home')}
            role={role}
          />
        )}

        {currentPage === 'labels' && (
          <LabelGeneratorPage
            onBack={() => setCurrentPage('home')}
          />
        )}

        {currentPage === 'stats' && (
          <StatsPage
            projects={projects}
            onBack={() => setCurrentPage('home')}
          />
        )}

        {currentPage === 'health' && (
          <HealthCheckPage
            onBack={() => setCurrentPage('home')}
          />
        )}
      </main>

      {currentPage === 'home' && (
        <footer className="app-footer">
          <p>Intégré avec Home Assistant et InfluxDB</p>
        </footer>
      )}
    </div>
  );
}

export default App;
