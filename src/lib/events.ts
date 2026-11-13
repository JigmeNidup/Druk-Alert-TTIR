export const ALERT_STARTED = "Alert started";
export const RESOLVED_ACKNOWLEDGED = "Resolved · acknowledged first";
export const RESOLVED_UNACKNOWLEDGED = "Resolved · not acknowledged";

export function isResolvedAction(action: string) {
  return action === RESOLVED_ACKNOWLEDGED || action === RESOLVED_UNACKNOWLEDGED;
}
