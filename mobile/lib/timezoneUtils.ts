/**
 * Timezone utility functions for consistent date/time handling
 * 
 * All dates are stored in UTC in the database and converted to local time
 * only for display purposes. This ensures consistency across timezones.
 */

/**
 * Get the user's current timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get today's date string in YYYY-MM-DD format (local timezone)
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a local date string (YYYY-MM-DD) and time string (HH:MM) to UTC ISO string
 * This is used when storing dates in the database
 * 
 * @param dateString - Date in YYYY-MM-DD format (local timezone)
 * @param timeString - Time in HH:MM format (local timezone)
 * @returns ISO string in UTC (e.g., "2025-12-07T14:00:00.000Z")
 */
export function localDateTimeToUTC(dateString: string, timeString: string): string {
  // Parse as local time
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute] = timeString.split(':').map(Number);
  
  // Create date in local timezone
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  
  // Return as UTC ISO string
  return localDate.toISOString();
}

/**
 * Convert a UTC ISO string to local date string (YYYY-MM-DD)
 * This is used for displaying dates
 * 
 * @param utcISOString - ISO string in UTC (e.g., "2025-12-07T14:00:00.000Z")
 * @returns Date string in YYYY-MM-DD format (local timezone)
 */
export function utcToLocalDateString(utcISOString: string): string {
  const date = new Date(utcISOString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a UTC ISO string to local time string (HH:MM)
 * This is used for displaying times
 * 
 * @param utcISOString - ISO string in UTC (e.g., "2025-12-07T14:00:00.000Z")
 * @returns Time string in HH:MM format (local timezone)
 */
export function utcToLocalTimeString(utcISOString: string): string {
  const date = new Date(utcISOString);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

/**
 * Convert a UTC ISO string to a local Date object
 * This is used for date operations that need to respect local timezone
 * 
 * @param utcISOString - ISO string in UTC
 * @returns Date object representing the local time
 */
export function utcToLocalDate(utcISOString: string): Date {
  const date = new Date(utcISOString);
  // Extract local components and create a new date
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Get the day of week (0=Sunday, 1=Monday, etc.) from a UTC ISO string
 * Returns the day of week in the local timezone
 * 
 * @param utcISOString - ISO string in UTC
 * @returns Day of week (0-6)
 */
export function getDayOfWeekFromUTC(utcISOString: string): number {
  const date = new Date(utcISOString);
  return date.getDay();
}

/**
 * Check if a UTC ISO string falls on a specific date (in local timezone)
 * 
 * @param utcISOString - ISO string in UTC
 * @param dateString - Date string in YYYY-MM-DD format (local timezone)
 * @returns true if the UTC date falls on the given local date
 */
export function utcDateMatchesLocalDate(utcISOString: string, dateString: string): boolean {
  const localDateStr = utcToLocalDateString(utcISOString);
  return localDateStr === dateString;
}

/**
 * Get start and end of day in UTC for a given local date
 * Used for database queries to find all schedules for a specific day
 * 
 * @param dateString - Date string in YYYY-MM-DD format (local timezone)
 * @returns Object with startOfDay and endOfDay as UTC ISO strings
 */
export function getDayBoundsUTC(dateString: string): { startOfDay: string; endOfDay: string } {
  // Start of day: 00:00:00 in local timezone
  const startUTC = localDateTimeToUTC(dateString, '00:00');
  
  // End of day: 23:59:59 in local timezone
  const endUTC = localDateTimeToUTC(dateString, '23:59');
  
  // For end of day, we want to include the full second, so add 59 seconds
  const endDate = new Date(endUTC);
  endDate.setSeconds(59);
  endDate.setMilliseconds(999);
  
  return {
    startOfDay: startUTC,
    endOfDay: endDate.toISOString()
  };
}

/**
 * Format a UTC ISO string for display as a readable date
 * 
 * @param utcISOString - ISO string in UTC
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatUTCDateForDisplay(
  utcISOString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(utcISOString);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...options
  };
  return date.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format a UTC ISO string for display as time (HH:MM AM/PM)
 * 
 * @param utcISOString - ISO string in UTC
 * @returns Formatted time string (e.g., "02:00 PM")
 */
export function formatUTCTimeForDisplay(utcISOString: string): string {
  const date = new Date(utcISOString);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour.toString().padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

/**
 * Check if a UTC date is on or after a local date string
 * Used for filtering recurring schedules
 * 
 * @param utcISOString - ISO string in UTC
 * @param dateString - Date string in YYYY-MM-DD format (local timezone)
 * @returns true if UTC date is on or after the local date
 */
export function utcDateOnOrAfterLocalDate(utcISOString: string, dateString: string): boolean {
  const utcLocalDateStr = utcToLocalDateString(utcISOString);
  return utcLocalDateStr >= dateString;
}

