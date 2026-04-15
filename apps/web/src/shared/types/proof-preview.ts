export type ProofPreviewMode = 'archive' | 'kkfileview' | 'native';

export type ProofPreviewMeta = {
  proofId: string;
  entryPath: string | null;
  fileName: string;
  mode: ProofPreviewMode;
  targetUrl: string;
  fallbackUrl: string | null;
  downloadUrl: string;
  contentType: string | null;
};

export type ProofArchiveEntry = {
  path: string;
  name: string;
  fileSize: number | null;
  extension: string | null;
  previewUrl: string;
  downloadUrl: string;
};

export type ProofArchiveManifest = {
  proofId: string;
  fileName: string;
  downloadUrl: string;
  entryCount: number;
  entries: ProofArchiveEntry[];
};
