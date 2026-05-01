import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { useConnectivityStore } from './connectivityService';

const SYNC_QUEUE_KEY = '@sync_queue';

export const queueAction = async (action) => {
  try {
    const queueRaw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue = queueRaw ? JSON.parse(queueRaw) : [];
    
    // Add timestamp to resolution
    const enrichedAction = {
      ...action,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    };
    
    queue.push(enrichedAction);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    console.log(`[Sync] Action queued: ${action.method} ${action.url}`);
    return enrichedAction;
  } catch (err) {
    console.error('[Sync] Failed to queue action:', err);
  }
};

export const flushSyncQueue = async () => {
  const { isConnected, isInternetReachable } = useConnectivityStore.getState();
  if (!isConnected || !isInternetReachable) return;

  try {
    const queueRaw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!queueRaw) return;
    
    let queue = JSON.parse(queueRaw);
    if (queue.length === 0) return;

    console.log(`[Sync] Flushing ${queue.length} actions...`);
    
    const remainingQueue = [];
    
    for (const action of queue) {
      try {
        await api({
          method: action.method,
          url: action.url,
          data: action.data,
          params: action.params,
          headers: { 'x-sync-id': action.id }
        });
        console.log(`[Sync] Success: ${action.method} ${action.url}`);
      } catch (err) {
        const attempts = (action.retryCount || 0) + 1;
        console.error(`[Sync] Attempt ${attempts} failed for ${action.id}:`, err.message);
        
        // If it's a 4xx error (logic error) or we exceeded 3 retries, don't retry.
        const isClientError = err.response && err.response.status >= 400 && err.response.status < 500;
        if (isClientError || attempts >= 3) {
          console.warn(`[Sync] Action ${action.id} discarded (Permanent error or max retries).`);
        } else {
          remainingQueue.push({ ...action, retryCount: attempts });
        }
      }
    }
    
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
  } catch (err) {
    console.error('[Sync] Flush error:', err);
  }
};
