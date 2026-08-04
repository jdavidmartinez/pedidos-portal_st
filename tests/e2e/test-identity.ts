const runId = (process.env.GITHUB_RUN_ID ?? "local").replace(/[^a-zA-Z0-9_-]/g, "");

export const E2E_PASSWORD = "E2E-Portal-password-123!";
export const E2E_KITCHEN_USERNAME = `e2e-kitchen-${runId}`;
export const E2E_ADMIN_USERNAME = `e2e-admin-${runId}`;
