import { onCLS, onFID, onLCP, Metric } from 'web-vitals';
import { logger } from './logger';

function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify(metric);
  // Log to console/logger in dev
  logger.info("Web Vitals", { metric: metric.name, value: metric.value, id: metric.id });

  // Example of saving to sessionStorage
  if (typeof sessionStorage !== "undefined") {
    const vitals = JSON.parse(sessionStorage.getItem("__vitals") || "[]");
    vitals.push(metric);
    sessionStorage.setItem("__vitals", JSON.stringify(vitals));
  }
}

export function reportWebVitals() {
  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
}
