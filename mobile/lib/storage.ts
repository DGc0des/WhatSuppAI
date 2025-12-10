import { supabase } from '../supabase-client';
import { ensureAuthenticated } from './auth';

export interface Supplement {
  id: number;
  created_at: string;
  barcode: string;
  name: string;
  brand: string;
  image?: string;
  analysis?: string;
  rating?: number;
  user_id: string;
  scores?: {
    effectiveness?: number;
    quality?: number;
    safety?: number;
    value?: number;
    satisfaction?: number;
    taste?: number;
  };
}

// Alias for backwards compatibility
export type ScannedSupplement = Supplement;

// ============================================
// HISTORY FUNCTIONS (scan history)
// ============================================

export async function saveToHistory(supplement: {
  barcode: string;
  name: string;
  brand: string;
  image?: string;
  analysis?: string;
  rating?: number;
  scores?: {
    effectiveness?: number;
    quality?: number;
    safety?: number;
    value?: number;
    satisfaction?: number;
    taste?: number;
  };
}): Promise<Supplement> {
  try {
    const userId = await ensureAuthenticated();

    // Check if already in history
    const { data: existing, error: fetchError } = await supabase
      .from('History')
      .select('*')
      .eq('barcode', supplement.barcode)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existing) {
      // Update existing history entry with latest data
      const { data: updated, error: updateError } = await supabase
        .from('History')
        .update({
          rating: supplement.rating,
          scores: supplement.scores,
          analysis: supplement.analysis,
          name: supplement.name,
          brand: supplement.brand,
          image: supplement.image,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updated;
    }

    // Insert new history entry
    const { data, error } = await supabase
      .from('History')
      .insert([{ ...supplement, user_id: userId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('[saveToHistory] Error:', error);
    throw error;
  }
}

export async function getAllHistory(): Promise<Supplement[]> {
  try {
    await ensureAuthenticated();

    const { data, error } = await supabase
      .from('History')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[getAllHistory] Error:', error);
    return [];
  }
}

export async function deleteFromHistory(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('History')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('[deleteFromHistory] Error:', error);
    throw error;
  }
}

// ============================================
// STACK FUNCTIONS (user's curated supplements)
// ============================================

export async function addToStack(supplement: {
  barcode: string;
  name: string;
  brand: string;
  image?: string;
  analysis?: string;
  rating?: number;
  scores?: {
    effectiveness?: number;
    quality?: number;
    safety?: number;
    value?: number;
    satisfaction?: number;
    taste?: number;
  };
}): Promise<Supplement> {
  try {
    const userId = await ensureAuthenticated();

    // Check if already in stack
    const { data: existing } = await supabase
      .from('Stack')
      .select('*')
      .eq('barcode', supplement.barcode)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Already in stack, just return it
      return existing;
    }

    // Add to stack
    const { data, error } = await supabase
      .from('Stack')
      .insert([{ ...supplement, user_id: userId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('[addToStack] Error:', error);
    throw error;
  }
}

export async function getAllStack(): Promise<Supplement[]> {
  try {
    await ensureAuthenticated();

    const { data, error } = await supabase
      .from('Stack')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[getAllStack] Error:', error);
    return [];
  }
}

export async function removeFromStack(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('Stack')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('[removeFromStack] Error:', error);
    throw error;
  }
}

export async function isInStack(barcode: string): Promise<boolean> {
  try {
    const userId = await ensureAuthenticated();

    const { data, error } = await supabase
      .from('Stack')
      .select('id')
      .eq('barcode', barcode)
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (error) {
    console.error('[isInStack] Error:', error);
    return false;
  }
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

// Keep old function names for backwards compatibility during migration
export async function saveScannedSupplement(supplement: {
  barcode: string;
  name: string;
  brand: string;
  image?: string;
  analysis?: string;
  rating?: number;
  scores?: any;
}): Promise<Supplement> {
  return saveToHistory(supplement);
}

export async function getAllScannedSupplements(): Promise<ScannedSupplement[]> {
  // Legacy: now returns stack instead
  return getAllStack();
}

export async function deleteScannedSupplement(id: number) {
  // Legacy: now deletes from stack
  return removeFromStack(id);
}

export async function clearAllScannedSupplements() {
  // Not implemented for safety - user should delete items individually
  console.warn('clearAllScannedSupplements is deprecated');
}
