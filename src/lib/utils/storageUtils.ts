/**
 * Safe localStorage operations with error handling
 */

/**
 * Error types for storage operations
 */
export enum StorageErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PARSE_ERROR = 'PARSE_ERROR',
  ACCESS_DENIED = 'ACCESS_DENIED',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Storage operation result
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: {
    type: StorageErrorType;
    message: string;
  };
}

/**
 * Check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely get item from localStorage with JSON parsing
 * @param key - Storage key
 * @returns Storage result with parsed data or error
 */
export function safeGetItem<T>(key: string): StorageResult<T> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: {
        type: StorageErrorType.NOT_AVAILABLE,
        message: 'LocalStorage is not available'
      }
    };
  }

  try {
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return { success: true, data: undefined };
    }

    const parsed = JSON.parse(item) as T;
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: {
          type: StorageErrorType.PARSE_ERROR,
          message: `Failed to parse stored data: ${error.message}`
        }
      };
    }

    return {
      success: false,
      error: {
        type: StorageErrorType.UNKNOWN,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    };
  }
}

/**
 * Safely set item in localStorage with JSON stringification
 * @param key - Storage key
 * @param value - Value to store
 * @returns Storage result indicating success or failure
 */
export function safeSetItem<T>(key: string, value: T): StorageResult<void> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: {
        type: StorageErrorType.NOT_AVAILABLE,
        message: 'LocalStorage is not available'
      }
    };
  }

  try {
    const stringified = JSON.stringify(value);
    window.localStorage.setItem(key, stringified);
    return { success: true };
  } catch (error) {
    if (error instanceof DOMException) {
      // Check for quota exceeded error
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        return {
          success: false,
          error: {
            type: StorageErrorType.QUOTA_EXCEEDED,
            message: 'LocalStorage quota exceeded'
          }
        };
      }
      
      // Check for security error
      if (error.name === 'SecurityError') {
        return {
          success: false,
          error: {
            type: StorageErrorType.ACCESS_DENIED,
            message: 'Access to localStorage was denied'
          }
        };
      }
    }

    return {
      success: false,
      error: {
        type: StorageErrorType.UNKNOWN,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    };
  }
}

/**
 * Safely remove item from localStorage
 * @param key - Storage key
 * @returns Storage result indicating success or failure
 */
export function safeRemoveItem(key: string): StorageResult<void> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: {
        type: StorageErrorType.NOT_AVAILABLE,
        message: 'LocalStorage is not available'
      }
    };
  }

  try {
    window.localStorage.removeItem(key);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        type: StorageErrorType.UNKNOWN,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    };
  }
}

/**
 * Clear all items from localStorage (use with caution)
 * @returns Storage result indicating success or failure
 */
export function safeClear(): StorageResult<void> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: {
        type: StorageErrorType.NOT_AVAILABLE,
        message: 'LocalStorage is not available'
      }
    };
  }

  try {
    window.localStorage.clear();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: {
        type: StorageErrorType.UNKNOWN,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    };
  }
}

/**
 * Get storage size in bytes
 * @returns Current localStorage usage in bytes, or -1 if unable to calculate
 */
export function getStorageSize(): number {
  if (!isLocalStorageAvailable()) {
    return -1;
  }

  try {
    let totalSize = 0;
    for (const key in window.localStorage) {
      if (window.localStorage.hasOwnProperty(key)) {
        const value = window.localStorage.getItem(key);
        if (value) {
          // Calculate size in bytes (UTF-16 encoding)
          totalSize += key.length + value.length;
        }
      }
    }
    return totalSize * 2; // UTF-16 uses 2 bytes per character
  } catch {
    return -1;
  }
}

/**
 * Check if storage is nearly full (>90% of 5MB typical limit)
 * @returns true if storage is nearly full
 */
export function isStorageNearlyFull(): boolean {
  const size = getStorageSize();
  if (size === -1) return false;
  
  // Most browsers have a 5-10MB limit for localStorage
  const typicalLimit = 5 * 1024 * 1024; // 5MB in bytes
  return size > typicalLimit * 0.9;
}