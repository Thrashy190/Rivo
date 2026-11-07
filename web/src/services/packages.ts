import { api, ApiError } from "./api";

// The largest .zip the API accepts (MaxPackageBytes in services/shared).
export const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;

interface PackageUpload {
  packageId: string;
  url: string;
  fields: Record<string, string>;
  expiresAt: number;
}

export interface PackageDownload {
  packageId: string;
  size: number;
  url: string;
}

const base = (workspaceId: string, projectId: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/packages`;

// Sends the file straight to S3 with the presigned form, reporting progress
// from 0 to 1. S3 answers 204 when it has the whole file.
function postToS3(upload: PackageUpload, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", upload.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, "S3 did not accept the file. Try again, or check its size."));
    xhr.onerror = () => reject(new ApiError(0, "The upload was interrupted. Check your connection and try again."));
    xhr.send(form);
  });
}

export const packagesService = {
  // Uploads a Lambda's .zip and returns its ID, which the diagram keeps.
  upload: async (workspaceId: string, projectId: string, file: File, onProgress: (fraction: number) => void) => {
    const upload = await api.post<PackageUpload>(base(workspaceId, projectId), { fileName: file.name, size: file.size });
    await postToS3(upload, file, onProgress);
    return upload.packageId;
  },

  // A link that downloads the package for a few minutes.
  download: (workspaceId: string, projectId: string, packageId: string, fileName: string) =>
    api.get<PackageDownload>(
      `${base(workspaceId, projectId)}/${encodeURIComponent(packageId)}?fileName=${encodeURIComponent(fileName)}`,
    ),
};
