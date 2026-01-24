// Build trigger: 2025-12-15T20:00
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

type Page = 'home' | 'create-project' | 'monitoring' | 'brewing-session' | 'devices' | 'summary' | 'labels' | 'stats';

// Clés localStorage pour la persistance de navigation
const NAV_STORAGE_KEY = 'myfermentlab_nav_state';

interface NavState {
  currentPage: Page;
  selectedProjectId: string | null;
}

// Fonction pour lire l'état de navigation depuis localStorage
const getStoredNavState = (): NavState => {
  try {
    const saved = localStorage.getItem(NAV_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as NavState;
      const validPages: Page[] = ['home', 'create-project', 'monitoring', 'brewing-session', 'devices', 'summary', 'labels', 'stats'];
      if (validPages.includes(parsed.currentPage)) {
        console.log('[Nav] Restored state:', parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Nav] Failed to restore navigation state:', e);
  }
  return { currentPage: 'home', selectedProjectId: null };
};

function App() {
  const { isAuthenticated, role, logout } = useAuth();

  // Utiliser une fonction d'initialisation lazy pour éviter les problèmes de timing
  const [currentPage, setCurrentPage] = useState<Page>(() => getStoredNavState().currentPage);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => getStoredNavState().selectedProjectId);
  const [navInitialized, setNavInitialized] = useState(false);
  const [showHealthFromLogin, setShowHealthFromLogin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Marquer la navigation comme initialisée après le premier rendu
  useEffect(() => {
    setNavInitialized(true);
  }, []);

  // Sauvegarder l'état de navigation seulement après l'initialisation
  useEffect(() => {
    if (navInitialized) {
      const navState: NavState = { currentPage, selectedProjectId };
      console.log('[Nav] Saving state:', navState);
      localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(navState));
    }
  }, [currentPage, selectedProjectId, navInitialized]);

  // États
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectWithHistory | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DateTime pour le header SCADA
  const [datetime, setDatetime] = useState('');

  // Charger les projets et appareils au démarrage
  useEffect(() => {
    loadInitialData();
  }, []);

  // Vérifier que le projet restauré existe toujours après le chargement initial
  useEffect(() => {
    if (!loading && selectedProjectId && projects.length > 0) {
      const projectExists = projects.some(p => p.id === selectedProjectId);
      if (!projectExists) {
        // Le projet n'existe plus, revenir à l'accueil
        console.log('Restored project no longer exists, navigating to home');
        setSelectedProjectId(null);
        setCurrentPage('home');
      }
    }
  }, [loading, projects, selectedProjectId]);

  // Charger le projet sélectionné avec son historique
  useEffect(() => {
    if (selectedProjectId) {
      loadProject(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Rafraîchir la température toutes les 5 secondes si on est sur la page de monitoring
  // Utilise getLiveTemperature pour récupérer directement depuis Home Assistant
  // ce qui permet aussi de déclencher le contrôle automatique de la prise côté backend
  useEffect(() => {
    if (currentPage === 'monitoring' && selectedProjectId) {
      const refreshTemperature = async () => {
        try {
          const data = await apiService.getLiveTemperature(selectedProjectId);
          setSelectedProject(prev => prev ? {
            ...prev,
            currentTemperature: data.temperature
          } : null);
          setProjects(prev => prev.map(p =>
            p.id === selectedProjectId ? { ...p, currentTemperature: data.temperature } : p
          ));

          // Si la prise a changé d'état, recharger le projet complet pour avoir l'état à jour
          if (data.outletChanged) {
            loadProject(selectedProjectId);
          }
        } catch (err) {
          console.error('Failed to refresh temperature:', err);
        }
      };

      const interval = setInterval(refreshTemperature, 5000);

      return () => clearInterval(interval);
    }
  }, [currentPage, selectedProjectId]);

  // Mettre à jour la date/heure pour le header SCADA
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      };
      setDatetime(now.toLocaleDateString('fr-FR', options));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);


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

  const handleUpdateProjectSettings = async (data: { humiditySensorId?: string; targetHumidity?: number }) => {
    if (!selectedProjectId) return;

    try {
      const updatedProject = await apiService.updateProject(selectedProjectId, data);
      setSelectedProject(prev => prev ? { ...prev, ...updatedProject } : null);
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectId ? { ...p, ...updatedProject } : p
      ));
    } catch (err) {
      console.error('Failed to update project settings:', err);
      throw err;
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

  const handleRefreshTemperature = async () => {
    if (!selectedProjectId) return;

    try {
      const data = await apiService.getLiveTemperature(selectedProjectId);
      // Mettre à jour la température dans le projet sélectionné
      setSelectedProject(prev => prev ? { ...prev, currentTemperature: data.temperature } : null);
      setProjects(prev => prev.map(p =>
        p.id === selectedProjectId ? { ...p, currentTemperature: data.temperature } : p
      ));
    } catch (err) {
      console.error('Failed to refresh temperature:', err);
      setError('Impossible de récupérer la température depuis Home Assistant');
    }
  };

  const handleRefreshProjectTemperature = async (projectId: string) => {
    try {
      const data = await apiService.getLiveTemperature(projectId);
      // Mettre à jour seulement la température du projet (pas l'état de la prise)
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, currentTemperature: data.temperature } : p
      ));
      if (selectedProjectId === projectId) {
        setSelectedProject(prev => prev ? { ...prev, currentTemperature: data.temperature } : null);
      }
    } catch (err) {
      console.error('Failed to refresh project temperature:', err);
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
    <div className="scada-app">
      <header className="scada-header">
        <div className="scada-logo">
          <div className="scada-logo-icon">🧪</div>
          <div className="scada-logo-text">MyFerment<span>Lab</span></div>
        </div>

        {/* Mobile: Back button in header when not on home */}
        {currentPage !== 'home' && (
          <button className="scada-header-btn mobile-back-btn" onClick={() => setCurrentPage('home')}>
            ← Accueil
          </button>
        )}

        {/* Mobile: Hard refresh button */}
        {currentPage === 'home' && (
          <button
            className="mobile-refresh-btn"
            onClick={() => window.location.reload()}
            aria-label="Rafraîchir"
          >
            ↻
          </button>
        )}

        {/* Mobile hamburger menu button */}
        {currentPage === 'home' && (
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        )}

        <div className={`scada-header-actions ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          {currentPage === 'home' && (
            <>
              <div className="scada-system-status">
                <div className="scada-status-dot"></div>
                <span>Systèmes opérationnels</span>
              </div>
              <button className="scada-header-btn" onClick={() => { setCurrentPage('devices'); setMobileMenuOpen(false); }}>
                <span>⚙️</span>
                Appareils
              </button>
              <button className="scada-header-btn" onClick={() => { setCurrentPage('stats'); setMobileMenuOpen(false); }}>
                <span>📊</span>
                Statistiques
              </button>
              <button className="scada-header-btn" onClick={() => { setCurrentPage('labels'); setMobileMenuOpen(false); }}>
                <span>🏷️</span>
                Étiquettes
              </button>
              {role === 'admin' && (
                <button className="scada-header-btn primary" onClick={() => { setCurrentPage('create-project'); setMobileMenuOpen(false); }}>
                  <span>+</span>
                  Nouveau projet
                </button>
              )}
              <button className="scada-header-btn" onClick={() => { logout(); setMobileMenuOpen(false); }}>
                Déconnexion
              </button>
            </>
          )}
          {/* Desktop only: back button */}
          {currentPage !== 'home' && (
            <button className="scada-header-btn desktop-back-btn" onClick={() => setCurrentPage('home')}>
              ← Accueil
            </button>
          )}
          <div className="scada-datetime">{datetime}</div>
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

      <main className="scada-main">
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
            onRefreshProject={handleRefreshProjectTemperature}
            onRefreshData={loadInitialData}
            onManageDevices={() => setCurrentPage('devices')}
            onLabelGenerator={() => setCurrentPage('labels')}
            onViewStats={() => setCurrentPage('stats')}
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
            devices={devices}
            usedDeviceIds={usedDeviceIds}
            onUpdateTarget={handleUpdateTarget}
            onToggleOutlet={handleToggleOutlet}
            onAddDensity={handleAddDensity}
            onAddHumidity={handleAddHumidity}
            onToggleControlMode={handleToggleControlMode}
            onRefreshTemperature={handleRefreshTemperature}
            onUpdateProject={handleUpdateProjectSettings}
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
      </main>

    </div>
  );
}

export default App;
