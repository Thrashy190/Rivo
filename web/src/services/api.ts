// src/services/{auth,projects,spaces}.ts read and write sample data
// (see src/services/mockStore.ts) until they are connected to the API.
// ApiError is kept so error-handling call sites don't need to change shape.
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
