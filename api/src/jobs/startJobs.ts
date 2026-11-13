import { startComplianceSnapshotJob } from "./complianceSnapshotJob.js";
import { startCourseExpiryNotificationJob } from "./courseExpiryJob.js";
import { startNotificationOutboxJob } from "./notificationOutboxJob.js";

/**
 * Arranca todos los jobs en-proceso (patrón A).
 * Cada job respeta su propio *_ENABLED=false.
 */
export function startJobs(): void {
  startNotificationOutboxJob();
  startCourseExpiryNotificationJob();
  startComplianceSnapshotJob();
}
