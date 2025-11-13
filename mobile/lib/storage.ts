import { supabase } from '../supabase-client';
import { ensureAuthenticated } from './auth';

export interface ScannedSupplement {
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

export async function saveScannedSupplement(supplement: {
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
}) {
  try {
    // Ensure user is authenticated
    const userId = await ensureAuthenticated();

    // Check if barcode already exists for this user
    const { data: existing, error: fetchError } = await supabase
      .from('Scanned')
      .select('*')
      .eq('barcode', supplement.barcode)
      .eq('user_id', userId)
      .maybeSingle();

    // If there's an error other than "no rows", throw it
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[saveScannedSupplement] Error fetching existing supplement:', fetchError);
      throw fetchError;
    }

    if (existing) {
      // Check if scores or rating have changed
      const scoresChanged = JSON.stringify(existing.scores) !== JSON.stringify(supplement.scores);
      const ratingChanged = existing.rating !== supplement.rating;
      const analysisChanged = existing.analysis !== supplement.analysis;

      if (scoresChanged || ratingChanged || analysisChanged) {
        console.log('[saveScannedSupplement] Updating existing supplement with new scores/rating');

        // Update the existing record with new data
        const { data: updated, error: updateError } = await supabase
          .from('Scanned')
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
          .maybeSingle();

        if (updateError) {
          console.error('[saveScannedSupplement] Error updating supplement:', updateError);
          throw updateError;
        }

        console.log('[saveScannedSupplement] Successfully updated');
        return updated;
      } else {
        console.log('[saveScannedSupplement] Supplement exists with same scores, no update needed');
        return existing;
      }
    }

    // Insert new supplement with user_id
    const supplementData = { ...supplement, user_id: userId };
    console.log('[saveScannedSupplement] Attempting to insert:', JSON.stringify(supplementData, null, 2));

    const { data, error } = await supabase
      .from('Scanned')
      .insert([supplementData])
      .select()
      .maybeSingle();

    if (error) {
      console.error('[saveScannedSupplement] Supabase error:', error);
      throw error;
    }

    console.log('[saveScannedSupplement] Successfully inserted');
    return data;
  } catch (error: any) {
    console.error('[saveScannedSupplement] Error saving supplement:', error);
    console.error('[saveScannedSupplement] Error details:', error.message, error.details, error.hint);
    throw error;
  }
}

export async function getAllScannedSupplements(): Promise<ScannedSupplement[]> {
  try {
    // Ensure user is authenticated
    await ensureAuthenticated();

    // With RLS enabled, this will automatically filter by user_id
    const { data, error } = await supabase
      .from('Scanned')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting supplements:', error);
    return [];
  }
}

export async function deleteScannedSupplement(id: number) {
  try {
    const { error } = await supabase
      .from('Scanned')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting supplement:', error);
    throw error;
  }
}

export async function clearAllScannedSupplements() {
  try {
    const { error } = await supabase
      .from('Scanned')
      .delete()
      .neq('id', 0); // Delete all records

    if (error) throw error;
  } catch (error) {
    console.error('Error clearing supplements:', error);
    throw error;
  }
}
