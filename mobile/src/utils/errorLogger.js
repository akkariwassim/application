/**
 * errorLogger.js
 *
 * Captures all JS errors and unhandled promise rejections from the device
 * and prints them to the Metro terminal via console.error.
 *
 * Call `initErrorLogger()` once at app startup (before React renders).
 */

const PREFIX = '\n🔴 [PHONE ERROR]';
const SEP    = '─'.repeat(60);

/**
 * Format an error into a readable block for the terminal.
 */
function format(label, error, extra = '') {
  const msg   = error?.message || String(error);
  const stack = error?.stack   || '(no stack)';
  return `${PREFIX} ${label}\n${SEP}\n${extra}Message : ${msg}\nStack   :\n${stack}\n${SEP}`;
}

/**
 * Install global handlers. Safe to call multiple times.
 */
export function initErrorLogger() {
  // ── 1. Unhandled Promise Rejections ───────────────────────
  const originalHandler = global.Promise;

  if (global.__errorLoggerInstalled) return;
  global.__errorLoggerInstalled = true;

  // React Native exposes this on the global ErrorUtils object
  const previousGlobalHandler = global.ErrorUtils?.getGlobalHandler?.();

  if (global.ErrorUtils) {
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      console.error(
        format(
          isFatal ? 'FATAL JS ERROR' : 'JS ERROR',
          error,
          isFatal ? '⚠️  FATAL — app will reload\n' : ''
        )
      );
      // Still call the original handler so Expo's red screen works too
      previousGlobalHandler?.(error, isFatal);
    });
  }

  // ── 2. Unhandled Promise Rejections ───────────────────────
  const trackingHandler = (id, error) => {
    console.error(format('UNHANDLED PROMISE REJECTION', error, `Promise ID: ${id}\n`));
  };

  if (typeof global.HermesInternal !== 'undefined') {
    // Hermes engine (default in RN 0.70+)
    global.__onUnhandledRejection = trackingHandler;
  }

  // Polyfill for environments that expose this event
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledrejection', (event) => {
      console.error(format('UNHANDLED PROMISE REJECTION', event.reason));
    });
  }

  console.log('✅ [errorLogger] Global error handler installed — errors will appear here in the terminal.');
}
