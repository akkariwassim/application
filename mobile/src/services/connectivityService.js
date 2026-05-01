import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

// We'll require syncService dynamically to avoid circular dependencies

export const useConnectivityStore = create((set) => ({
  isConnected: true,
  isInternetReachable: true,
  type: 'unknown',
  setConnectivity: (status) => set({ 
    isConnected: !!status.isConnected, 
    isInternetReachable: !!status.isInternetReachable,
    type: status.type 
  }),
}));

let unsubscribe = null;

export const startConnectivityMonitoring = () => {
  if (unsubscribe) return;
  
  unsubscribe = NetInfo.addEventListener((state) => {
    const prevOnline = useConnectivityStore.getState().isConnected && useConnectivityStore.getState().isInternetReachable;
    const nowOnline = state.isConnected && state.isInternetReachable;

    useConnectivityStore.getState().setConnectivity(state);
    
    if (!prevOnline && nowOnline) {
      console.log('[Connectivity] Back online! Triggering sync flush...');
      const { flushSyncQueue } = require('./syncService');
      flushSyncQueue();
    }
  });
};

export const stopConnectivityMonitoring = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};
