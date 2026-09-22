export const env = { DB: undefined, FILES: undefined };

// vinext's Cloudflare type bridge imports these runtime base classes while
// bundling, even when the Vercel deployment does not instantiate them.
export class WorkerEntrypoint {}
export class DurableObject {}
export class WorkflowEntrypoint {}
