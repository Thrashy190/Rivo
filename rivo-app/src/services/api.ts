// The old rivo-api backend has been disconnected — src/services/{auth,projects,spaces}.ts
// now read/write dummy data (see src/services/mockStore.ts) instead of calling this.
// ApiError is kept only so error-handling call sites don't need to change shape;
// wire this back up to `fetch` once the new lambdas exist.
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
