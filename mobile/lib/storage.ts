import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@scanned_supplements';

export interface ScannedSupplement {
  id: string;
  timestamp: number;
  barcode: string;
  name: string;
  brand: string;
  image?: string;
  analysis?: string;
}

export async function saveScannedSupplement(supplement: Omit<ScannedSupplement, 'id' | 'timestamp'>) {
  try {
    const existing = await getAllScannedSupplements();
    const newSupplement: ScannedSupplement = {
      ...supplement,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    const updated = [newSupplement, ...existing];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newSupplement;
  } catch (error) {
    console.error('Error saving supplement:', error);
    throw error;
  }
}

export async function getAllScannedSupplements(): Promise<ScannedSupplement[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting supplements:', error);
    return [];
  }
}

export async function deleteScannedSupplement(id: string) {
  try {
    const existing = await getAllScannedSupplements();
    const updated = existing.filter(s => s.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting supplement:', error);
    throw error;
  }
}

export async function clearAllScannedSupplements() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing supplements:', error);
    throw error;
  }
}
