import { create } from 'zustand';
import useAnimalStore from './animalStore';
import useAlertStore from './alertStore';
import useGeofenceStore from './geofenceStore';
import { isPointInPolygon } from '../utils/geoUtils';
import api from '../services/api';

const SCENARIOS = {
  normal: {
    temp: [38.2, 38.8],
    hr: [60, 80],
    activity: [30, 50],
    speed: [0.5, 2],
    status: 'safe'
  },
  sleeping: {
    temp: [37.8, 38.3],
    hr: [45, 55],
    activity: [0, 5],
    speed: [0, 0.1],
    status: 'safe'
  },
  running: {
    temp: [39.0, 39.8],
    hr: [100, 140],
    activity: [80, 100],
    speed: [10, 25],
    status: 'warning'
  },
  stress: {
    temp: [38.8, 39.5],
    hr: [110, 150],
    activity: [60, 90],
    speed: [2, 8],
    status: 'warning'
  },
  sick: {
    temp: [40.2, 41.5],
    hr: [90, 110],
    activity: [5, 15],
    speed: [0.1, 0.5],
    status: 'danger'
  },
  escaped: {
    temp: [38.5, 39.5],
    hr: [90, 130],
    activity: [70, 100],
    speed: [5, 20],
    status: 'danger'
  },
  offline: {
    temp: [38.5, 38.5],
    hr: [0, 0],
    activity: [0, 0],
    speed: [0, 0],
    status: 'offline'
  }
};

const ALERT_COOLDOWNS = {
  high_temp: 10 * 60 * 1000, // 10 min
  breach:    Infinity,        // Once until resolved (handled by state)
  low_battery: 30 * 60 * 1000, // 30 min
  offline:   Infinity,
  heart_rate: 5 * 60 * 1000    // 5 min
};

const useSimulationStore = create((set, get) => ({
  isSimulationMode: false,
  selectedAnimalId: null,
  activeScenario: 'normal',
  simulatedData: {},
  lastAlertTimestamps: {},
  activeAlerts: new Set(), // Track active logical alerts to prevent duplicates
  
  // Stats for the UI
  logs: [],

  toggleSimulationMode: (val) => {
    const { startSimulation, stopSimulation } = get();
    set({ isSimulationMode: val });
    if (val) {
      startSimulation();
    } else {
      stopSimulation();
    }
  },

  setScenario: (scenario) => {
    set({ activeScenario: scenario });
    get().addLog(`Scenario changed to: ${scenario.toUpperCase()}`);
  },

  setSelectedAnimal: (id) => {
    set({ selectedAnimalId: id });
    get().addLog(`Simulating animal ID: ${id}`);
  },

  addLog: (msg) => {
    const log = { id: Date.now(), msg, time: new Date().toLocaleTimeString() };
    set(state => ({ logs: [log, ...state.logs].slice(0, 20) }));
  },

  startSimulation: () => {
    const interval = setInterval(() => {
      get().tick();
    }, 4000); // Update every 4 seconds
    set({ simulationInterval: interval });
    get().addLog('Simulation engine STARTED');
  },

  stopSimulation: () => {
    const { simulationInterval } = get();
    if (simulationInterval) clearInterval(simulationInterval);
    set({ simulationInterval: null });
    get().addLog('Simulation engine STOPPED');
  },

  tick: () => {
    const { isSimulationMode, selectedAnimalId, activeScenario, lastAlertTimestamps, activeAlerts } = get();
    if (!isSimulationMode || !selectedAnimalId) return;

    const animal = useAnimalStore.getState().animals.find(a => a.id === selectedAnimalId);
    if (!animal) return;

    const scenario = SCENARIOS[activeScenario];
    const rand = (min, max) => Math.random() * (max - min) + min;

    // 1. Generate core metrics
    const newData = {
      animalId: selectedAnimalId,
      latitude:  parseFloat(animal.latitude),
      longitude: parseFloat(animal.longitude),
      temperature: rand(scenario.temp[0], scenario.temp[1]).toFixed(1),
      heart_rate:  Math.round(rand(scenario.hr[0], scenario.hr[1])),
      activity:    Math.round(rand(scenario.activity[0], scenario.activity[1])),
      speed:       rand(scenario.speed[0], scenario.speed[1]).toFixed(1),
      battery_level: animal.battery_level || 85,
      status:      scenario.status,
      timestamp:   new Date()
    };

    // 2. Logic: Move animal if running or escaped
    if (activeScenario === 'running' || activeScenario === 'escaped' || activeScenario === 'normal') {
      const moveAmount = parseFloat(newData.speed) * 0.00001; // Roughly convert speed to lat/lng degrees
      newData.latitude  += (Math.random() - 0.5) * moveAmount;
      newData.longitude += (Math.random() - 0.5) * moveAmount;
    }

    // 3. Logic: Force escaped position if scenario is escaped
    if (activeScenario === 'escaped') {
      // Find a zone for this animal and move outside
      const zone = useGeofenceStore.getState().geofences.find(g => String(g.id) === String(animal.current_zone_id));
      if (zone && zone.polygon_coords) {
        // Simple logic: jump far away if not already outside
        const coords = typeof zone.polygon_coords === 'string' ? JSON.parse(zone.polygon_coords) : zone.polygon_coords;
        const isInside = isPointInPolygon({ latitude: newData.latitude, longitude: newData.longitude }, coords);
        if (isInside) {
          newData.latitude += 0.002; // Jump outside
          newData.longitude += 0.002;
        }
      }
    }

    // 4. Update Animal Store (UI will react)
    useAnimalStore.getState().updateAnimalPosition(selectedAnimalId, newData);
    useAnimalStore.getState().updateAnimalStatus(selectedAnimalId, newData.status);

    // 5. Sync with Backend (Professional Data Logging)
    api.post('/positions', {
      ...newData,
      gps_signal: 100 // Simulation is always perfect GPS
    }).catch(e => console.warn('[Sim] Sync failed:', e.message));

    // 6. SMART ALERT SYSTEM
    get().checkAlerts(newData, animal);

    set({ simulatedData: newData });
  },

  checkAlerts: (data, animal) => {
    const { activeScenario, lastAlertTimestamps, activeAlerts } = get();
    const now = Date.now();
    
    const triggerAlert = (type, severity, message, metadata = {}) => {
      const cooldown = ALERT_COOLDOWNS[type] || 60000;
      const lastTime = lastAlertTimestamps[type] || 0;
      
      if (now - lastTime < cooldown) return; // Still in cooldown

      // Add to store
      useAlertStore.getState().addAlert({
        id: `sim-${Date.now()}`,
        animal_id: data.animalId,
        animal_name: animal.name,
        type,
        severity,
        message,
        status: 'new',
        created_at: new Date(),
        ...metadata
      });

      // Update cooldowns
      set(state => ({
        lastAlertTimestamps: { ...state.lastAlertTimestamps, [type]: now }
      }));
      
      get().addLog(`ALERT TRIGGERED: ${type} (${severity.toUpperCase()})`);
    };

    // -- Temperature Alert --
    if (parseFloat(data.temperature) > 40.0) {
      triggerAlert('high_temp', 'critical', `Température critique détectée : ${data.temperature}°C`);
    } else if (parseFloat(data.temperature) > 39.2) {
      triggerAlert('high_temp', 'high', `Température élevée : ${data.temperature}°C`);
    }

    // -- Geofence Alert --
    if (activeScenario === 'escaped') {
      triggerAlert('breach', 'critical', `SORTIE DE ZONE : L'animal ${animal.name} a quitté son périmètre !`);
    }

    // -- Battery Alert --
    if (data.battery_level < 15) {
      triggerAlert('low_battery', 'high', `Batterie faible sur le collier de ${animal.name} (${data.battery_level}%)`);
    }

    // -- Offline Alert --
    if (activeScenario === 'offline') {
      triggerAlert('offline', 'critical', `PERTE DE SIGNAL : Le collier de ${animal.name} ne répond plus.`);
    }

    // -- Heart Rate --
    if (data.heart_rate > 140) {
      triggerAlert('heart_rate', 'critical', `Tachycardie suspectée : ${data.heart_rate} BPM`);
    }
  }
}));

export default useSimulationStore;
