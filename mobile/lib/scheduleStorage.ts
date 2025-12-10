import { supabase } from '../supabase-client';
import { ensureAuthenticated } from './auth';
import type { ScannedSupplement } from './storage';
import type { NotificationTiming } from './notificationService';

export interface ScheduledSupplement {
  id: number;
  user_id: string;
  supplement_id: number;
  scheduled_date: string;
  created_at: string;
  recurrence_type: 'once' | 'daily' | 'weekly';
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  dosage: string | null;
  notification_enabled: boolean;
  notification_timing: NotificationTiming;
  notification_id: string | null;
  supplement: ScannedSupplement;
}

/**
 * Get all scheduled supplements for the current user
 */
export async function getScheduledSupplements(): Promise<ScheduledSupplement[]> {
  try {
    const userId = await ensureAuthenticated();

    const { data, error } = await supabase
      .from('ScheduledSupplements')
      .select(`
        *,
        supplement:Stack(*)
      `)
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('[scheduleStorage] Error fetching scheduled supplements:', error);
      throw error;
    }

    console.log('[scheduleStorage] Fetched scheduled supplements count:', data?.length || 0);

    // Transform the data to flatten the supplement object
    const transformed = (data || []).map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      supplement_id: item.supplement_id,
      scheduled_date: item.scheduled_date,
      created_at: item.created_at,
      recurrence_type: item.recurrence_type || 'once',
      recurrence_days: item.recurrence_days || null,
      recurrence_end_date: item.recurrence_end_date || null,
      dosage: item.dosage || null,
      notification_enabled: item.notification_enabled || false,
      notification_timing: item.notification_timing || 'on-time',
      notification_id: item.notification_id || null,
      supplement: item.supplement
    }));

    console.log('[scheduleStorage] Sample scheduled_date from first item:', transformed[0]?.scheduled_date);

    return transformed;
  } catch (error) {
    console.error('[scheduleStorage] Error in getScheduledSupplements:', error);
    return [];
  }
}

/**
 * Get scheduled supplements for a specific date
 */
export async function getScheduledSupplementsForDate(date: string): Promise<ScheduledSupplement[]> {
  try {
    const userId = await ensureAuthenticated();

    // Get start and end of the day
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const { data, error } = await supabase
      .from('ScheduledSupplements')
      .select(`
        *,
        supplement:Stack(*)
      `)
      .eq('user_id', userId)
      .gte('scheduled_date', startOfDay)
      .lte('scheduled_date', endOfDay)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('[scheduleStorage] Error fetching scheduled supplements for date:', error);
      throw error;
    }

    const transformed = (data || []).map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      supplement_id: item.supplement_id,
      scheduled_date: item.scheduled_date,
      created_at: item.created_at,
      recurrence_type: item.recurrence_type || 'once',
      recurrence_days: item.recurrence_days || null,
      recurrence_end_date: item.recurrence_end_date || null,
      dosage: item.dosage || null,
      notification_enabled: item.notification_enabled || false,
      notification_timing: item.notification_timing || 'on-time',
      notification_id: item.notification_id || null,
      supplement: item.supplement
    }));

    return transformed;
  } catch (error) {
    console.error('[scheduleStorage] Error in getScheduledSupplementsForDate:', error);
    return [];
  }
}

/**
 * Add a scheduled supplement
 */
export async function addScheduledSupplement(
  supplementId: number,
  scheduledDate: string,
  recurrenceType: 'once' | 'daily' | 'weekly' = 'once',
  recurrenceDays: number[] | null = null,
  recurrenceEndDate: string | null = null,
  dosage: string | null = null,
  notificationEnabled: boolean = false,
  notificationTiming: NotificationTiming = 'on-time',
  notificationId: string | null = null
): Promise<ScheduledSupplement | null> {
  try {
    const userId = await ensureAuthenticated();

    const { data, error } = await supabase
      .from('ScheduledSupplements')
      .insert({
        user_id: userId,
        supplement_id: supplementId,
        scheduled_date: scheduledDate,
        recurrence_type: recurrenceType,
        recurrence_days: recurrenceDays,
        recurrence_end_date: recurrenceEndDate,
        dosage: dosage,
        notification_enabled: notificationEnabled,
        notification_timing: notificationTiming,
        notification_id: notificationId,
      })
      .select(`
        *,
        supplement:Stack(*)
      `)
      .maybeSingle();

    if (error) {
      console.error('[scheduleStorage] Error adding scheduled supplement:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      supplement_id: data.supplement_id,
      scheduled_date: data.scheduled_date,
      created_at: data.created_at,
      recurrence_type: data.recurrence_type || 'once',
      recurrence_days: data.recurrence_days || null,
      recurrence_end_date: data.recurrence_end_date || null,
      dosage: data.dosage || null,
      notification_enabled: data.notification_enabled || false,
      notification_timing: data.notification_timing || 'on-time',
      notification_id: data.notification_id || null,
      supplement: data.supplement
    };
  } catch (error) {
    console.error('[scheduleStorage] Error in addScheduledSupplement:', error);
    return null;
  }
}

/**
 * Delete a scheduled supplement
 */
export async function deleteScheduledSupplement(id: number): Promise<boolean> {
  try {
    const userId = await ensureAuthenticated();

    const { error } = await supabase
      .from('ScheduledSupplements')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[scheduleStorage] Error deleting scheduled supplement:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[scheduleStorage] Error in deleteScheduledSupplement:', error);
    return false;
  }
}

/**
 * Update a scheduled supplement
 */
export async function updateScheduledSupplement(
  id: number,
  updates: {
    scheduled_date?: string;
    recurrence_type?: 'once' | 'daily' | 'weekly';
    recurrence_days?: number[] | null;
    recurrence_end_date?: string | null;
    dosage?: string | null;
    notification_enabled?: boolean;
    notification_timing?: NotificationTiming;
    notification_id?: string | null;
  }
): Promise<ScheduledSupplement | null> {
  try {
    const userId = await ensureAuthenticated();

    const { data, error } = await supabase
      .from('ScheduledSupplements')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        supplement:Stack(*)
      `)
      .maybeSingle();

    if (error) {
      console.error('[scheduleStorage] Error updating scheduled supplement:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      supplement_id: data.supplement_id,
      scheduled_date: data.scheduled_date,
      created_at: data.created_at,
      recurrence_type: data.recurrence_type || 'once',
      recurrence_days: data.recurrence_days || null,
      recurrence_end_date: data.recurrence_end_date || null,
      dosage: data.dosage || null,
      notification_enabled: data.notification_enabled || false,
      notification_timing: data.notification_timing || 'on-time',
      notification_id: data.notification_id || null,
      supplement: data.supplement
    };
  } catch (error) {
    console.error('[scheduleStorage] Error in updateScheduledSupplement:', error);
    return null;
  }
}
