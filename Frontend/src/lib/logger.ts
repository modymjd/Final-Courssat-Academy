/**
 * Logging facade.
 *
 * Wrap console.* so we can later swap the sink for Sentry / Datadog / etc.
 * without touching call sites. In production the debug level is silenced.
 *
 * Do not import console.* directly anywhere else in the app.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogSink {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  captureException?: (err: unknown, ctx?: Record<string, unknown>) => void;
}

const IS_PROD = import.meta.env.PROD;

const consoleSink: LogSink = {
   
  debug: (...a) => (IS_PROD ? void 0 : console.debug(...a)),
   
  info: (...a) => console.info(...a),
   
  warn: (...a) => console.warn(...a),
   
  error: (...a) => console.error(...a),
};

let sink: LogSink = consoleSink;

export const logger = {
  debug: (...args: unknown[]) => sink.debug(...args),
  info: (...args: unknown[]) => sink.info(...args),
  warn: (...args: unknown[]) => sink.warn(...args),
  error: (...args: unknown[]) => sink.error(...args),

  /** Report an unhandled or handled exception to the observability backend. */
  captureException(err: unknown, ctx?: Record<string, unknown>): void {
    if (sink.captureException) sink.captureException(err, ctx);
    else sink.error("[exception]", err, ctx);
  },

  /** Swap the sink (e.g. install Sentry). */
  setSink(next: LogSink): void {
    sink = next;
  },
};

export type { LogLevel, LogSink };
