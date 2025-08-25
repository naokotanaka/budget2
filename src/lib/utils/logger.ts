/**
 * Centralized logging utility for the application
 * In production, these could be sent to a logging service
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

interface LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  error?: Error;
  data?: Record<string, any>;
  stack?: string;
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    // Check if we're in browser or server environment
    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
      // In browser, check for localhost or development domains
      this.isDevelopment = window.location.hostname === 'localhost' || 
                          window.location.hostname.includes('dev') ||
                          window.location.hostname === '127.0.0.1';
    } else {
      // In server, check NODE_ENV
      this.isDevelopment = process?.env?.NODE_ENV !== 'production';
    }
    
    this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  /**
   * Format log message with timestamp and level
   */
  private formatMessage(context: LogContext): string {
    const levelName = LogLevel[context.level];
    return `[${context.timestamp}] [${levelName}] ${context.message}`;
  }

  /**
   * Log to console or external service
   */
  private log(context: LogContext): void {
    if (context.level < this.minLevel) return;

    const formattedMessage = this.formatMessage(context);

    // In development, use console methods
    if (this.isDevelopment) {
      switch (context.level) {
        case LogLevel.DEBUG:
        case LogLevel.INFO:
          console.log(formattedMessage, context.data);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, context.data);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(formattedMessage, context.error || context.data);
          if (context.stack) {
            console.error(context.stack);
          }
          break;
      }
    } else {
      // In production, you could send to an external logging service
      // For now, only log errors to console in production
      if (context.level >= LogLevel.ERROR) {
        console.error(formattedMessage, context.error || context.data);
      }
    }
  }

  /**
   * Create log context
   */
  private createContext(
    level: LogLevel,
    message: string,
    errorOrData?: Error | Record<string, any>
  ): LogContext {
    const context: LogContext = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    if (errorOrData instanceof Error) {
      context.error = errorOrData;
      context.stack = errorOrData.stack;
    } else if (errorOrData) {
      context.data = errorOrData;
    }

    return context;
  }

  debug(message: string, data?: Record<string, any>): void {
    this.log(this.createContext(LogLevel.DEBUG, message, data));
  }

  info(message: string, data?: Record<string, any>): void {
    this.log(this.createContext(LogLevel.INFO, message, data));
  }

  warn(message: string, data?: Record<string, any>): void {
    this.log(this.createContext(LogLevel.WARN, message, data));
  }

  error(message: string, error?: Error | Record<string, any>): void {
    this.log(this.createContext(LogLevel.ERROR, message, error));
  }

  fatal(message: string, error?: Error | Record<string, any>): void {
    this.log(this.createContext(LogLevel.FATAL, message, error));
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Helper function to safely stringify errors for logging
 */
export function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Helper function to create error context for logging
 */
export function createErrorContext(
  operation: string,
  error: unknown,
  additionalData?: Record<string, any>
): Record<string, any> {
  return {
    operation,
    error: stringifyError(error),
    ...additionalData
  };
}