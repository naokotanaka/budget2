/**
 * Date utility functions for consistent date formatting across the application
 */

/**
 * Formats a Date object to yyyy-MM-dd string for HTML5 date inputs
 * @param date - Date object to format
 * @returns Formatted date string in yyyy-MM-dd format
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts various date formats to yyyy-MM-dd string
 * @param dateStr - Date string in various formats (yyyy/M/d, yyyy-MM-dd, etc.)
 * @returns Formatted date string in yyyy-MM-dd format or empty string if invalid
 */
export function convertToISOFormat(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return formatDateForInput(date);
  } catch {
    return '';
  }
}

/**
 * Gets the first and last day of a month
 * @param year - Year
 * @param month - Month (0-indexed, 0 = January)
 * @returns Object with formatted start and end dates
 */
export function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // Next month's 0th day = current month's last day
  
  return {
    startDate: formatDateForInput(start),
    endDate: formatDateForInput(end)
  };
}

/**
 * Calculates month offsets considering year boundaries
 * @param baseYear - Base year
 * @param baseMonth - Base month (0-indexed)
 * @param monthsOffset - Number of months to offset (negative for past)
 * @returns Object with adjusted year and month
 */
export function calculateMonthOffset(baseYear: number, baseMonth: number, monthsOffset: number): { year: number; month: number } {
  const totalMonths = baseYear * 12 + baseMonth + monthsOffset;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  
  // Handle negative modulo
  if (month < 0) {
    return { year: year - 1, month: month + 12 };
  }
  
  return { year, month };
}

/**
 * Validates if a date string is in valid format and represents a real date
 * @param dateStr - Date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Formats date for display in Japanese format
 * @param date - Date to format
 * @returns Formatted date string in Japanese locale
 */
export function formatDateJapanese(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    return dateObj.toLocaleDateString('ja-JP');
  } catch {
    return '';
  }
}

/**
 * Gets short format date (without year prefix)
 * @param date - Date to format
 * @returns Short formatted date string
 */
export function formatShortDateJapanese(date: string | Date | null | undefined): string {
  const formatted = formatDateJapanese(date);
  if (!formatted) return '';
  
  // Remove year prefix and adjust formatting
  return formatted.slice(2).replace(/\//g, '/');
}