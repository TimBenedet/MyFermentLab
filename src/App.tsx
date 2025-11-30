import { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { DevicesPage } from './pages/DevicesPage';
import { Project, Device, FermentationType } from './types';
import { apiService, ProjectWithHistory } from './services/api.service';
import './App.css';

type Page = 'home' | 'create-project' | 'monitoring' | 'devices';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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
  }) => {
    try {
      const newProject = await apiService.createProject(data);
      setProjects(prev => [...prev, newProject]);
      setSelectedProjectId(newProject.id);
      setCurrentPage('monitoring');
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Impossible de créer le projet');
    }
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentPage('monitoring');
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
      {currentPage === 'home' && (
        <header className="app-header">
          <h1>Moniteur de Fermentation</h1>
          <p className="app-subtitle">Contrôle et surveillance en temps réel</p>
        </header>
      )}

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
            onCreateProject={() => setCurrentPage('create-project')}
            onSelectProject={handleSelectProject}
            onDeleteProject={handleDeleteProject}
            onManageDevices={() => setCurrentPage('devices')}
          />
        )}

        {currentPage === 'create-project' && (
          <CreateProjectPage
            devices={devices}
            onCreateProject={handleCreateProject}
            onCancel={() => setCurrentPage('home')}
          />
        )}

        {currentPage === 'monitoring' && selectedProject && (
          <MonitoringPage
            project={selectedProject}
            onUpdateTarget={handleUpdateTarget}
            onToggleOutlet={handleToggleOutlet}
            onAddDensity={handleAddDensity}
            onToggleControlMode={handleToggleControlMode}
            onBack={() => setCurrentPage('home')}
          />
        )}

        {currentPage === 'devices' && (
          <DevicesPage
            devices={devices}
            onAddDevice={handleAddDevice}
            onDeleteDevice={handleDeleteDevice}
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
