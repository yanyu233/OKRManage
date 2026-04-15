import { createHash } from 'node:crypto';
import { extname } from 'node:path';

export type ProofLinkOptions = {
  proofId: string;
  fileName: string;
  sourceBaseUrl: string;
  previewBaseUrl: string;
  previewToken: string;
  webBaseUrl: string;
};

export type ProofPreviewMode = 'archive' | 'kkfileview' | 'native';

type ProofPreviewClassification = {
  mode: ProofPreviewMode;
  officePreviewType?: 'pdf';
  contentType: string | null;
};

const EXCEL_EXTENSIONS = new Set(['.xls', '.xlsx', '.xlsm', '.csv', '.ods']);
const PDF_OFFICE_EXTENSIONS = new Set(['.doc', '.docx', '.docm', '.ppt', '.pptx', '.pptm', '.rtf', '.odt', '.odp']);
const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4'
};

export function buildProofDownloadUrl(proofId: string) {
  return `/employee/proofs/${proofId}/download`;
}

export function buildProofPreviewUrl(options: ProofLinkOptions) {
  const classification = classifyProofPreview(options.fileName);
  const previewFileName = buildSafeProofPreviewFileName(options.fileName, options.proofId);

  if (classification.mode === 'archive') {
    return buildProofArchivePageUrl(options.proofId, options.webBaseUrl);
  }

  if (classification.mode === 'kkfileview') {
    if (classification.officePreviewType === 'pdf') {
      return buildInternalProofPreviewUrl({
        proofId: options.proofId,
        sourceBaseUrl: options.sourceBaseUrl,
        previewToken: options.previewToken
      });
    }

    return buildKkFileViewPreviewUrl({
      proofId: options.proofId,
      fileName: options.fileName,
      previewFileName,
      sourceBaseUrl: options.sourceBaseUrl,
      previewBaseUrl: options.previewBaseUrl,
      previewToken: options.previewToken,
      officePreviewType: classification.officePreviewType
    });
  }

  return buildProofSourceUrl({
    proofId: options.proofId,
    fileName: options.fileName,
    previewFileName,
    sourceBaseUrl: options.sourceBaseUrl,
    previewToken: options.previewToken
  });
}

export function buildProofSourceUrl(options: {
  proofId: string;
  fileName: string;
  previewFileName?: string;
  sourceBaseUrl: string;
  previewToken: string;
  entryPath?: string;
}) {
  const sourceUrl = new URL(`/api/internal/proofs/${options.proofId}/source`, options.sourceBaseUrl);
  sourceUrl.searchParams.set('accessToken', options.previewToken);
  sourceUrl.searchParams.set('fullfilename', options.previewFileName ?? options.fileName);
  if (options.entryPath) {
    sourceUrl.searchParams.set('entryPath', options.entryPath);
  }

  return sourceUrl.toString();
}

export function buildKkFileViewPreviewUrl(options: {
  proofId: string;
  fileName: string;
  previewFileName?: string;
  sourceBaseUrl: string;
  previewBaseUrl: string;
  previewToken: string;
  entryPath?: string;
  officePreviewType?: 'pdf' | 'image' | 'html';
}) {
  const sourceUrl = buildProofSourceUrl({
    proofId: options.proofId,
    fileName: options.fileName,
    previewFileName: options.previewFileName,
    sourceBaseUrl: options.sourceBaseUrl,
    previewToken: options.previewToken,
    entryPath: options.entryPath
  });
  const encodedSourceUrl = Buffer.from(sourceUrl, 'utf8').toString('base64');
  const normalizedPreviewBaseUrl = options.previewBaseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams();
  params.set('url', encodedSourceUrl);
  if (options.officePreviewType) {
    params.set('officePreviewType', options.officePreviewType);
  }

  return `${normalizedPreviewBaseUrl}/onlinePreview?${params.toString()}`;
}

export function buildProofArchivePageUrl(proofId: string, webBaseUrl: string) {
  return new URL(`/proofs/archive/${proofId}`, webBaseUrl).toString();
}

export function buildProofArchiveEntryPreviewUrl(options: {
  proofId: string;
  entryPath: string;
  fileName: string;
  sourceBaseUrl: string;
  previewBaseUrl: string;
  previewToken: string;
  webBaseUrl: string;
}) {
  const classification = classifyProofPreview(options.fileName, { allowArchive: false });
  const previewFileName = buildSafeProofPreviewFileName(options.fileName, `${options.proofId}:${options.entryPath}`);

  if (classification.mode === 'kkfileview') {
    if (classification.officePreviewType === 'pdf') {
      return buildInternalProofPreviewUrl({
        proofId: options.proofId,
        entryPath: options.entryPath,
        sourceBaseUrl: options.sourceBaseUrl,
        previewToken: options.previewToken
      });
    }

    return buildKkFileViewPreviewUrl({
      proofId: options.proofId,
      entryPath: options.entryPath,
      fileName: options.fileName,
      previewFileName,
      sourceBaseUrl: options.sourceBaseUrl,
      previewBaseUrl: options.previewBaseUrl,
      previewToken: options.previewToken,
      officePreviewType: classification.officePreviewType
    });
  }

  return buildProofSourceUrl({
    proofId: options.proofId,
    entryPath: options.entryPath,
    fileName: options.fileName,
    previewFileName,
    sourceBaseUrl: options.sourceBaseUrl,
    previewToken: options.previewToken
  });
}

export function buildProofArchiveEntryDownloadUrl(proofId: string, entryPath: string) {
  const params = new URLSearchParams();
  params.set('entryPath', entryPath);
  return `/employee/proofs/${proofId}/archive/entry?${params.toString()}`;
}

export function buildInternalProofPreviewUrl(options: {
  proofId: string;
  sourceBaseUrl: string;
  previewToken: string;
  entryPath?: string;
}) {
  const previewUrl = new URL(`/api/internal/proofs/${options.proofId}/preview`, options.sourceBaseUrl);
  previewUrl.searchParams.set('accessToken', options.previewToken);
  if (options.entryPath) {
    previewUrl.searchParams.set('entryPath', options.entryPath);
  }

  return previewUrl.toString();
}

export function buildInternalProofPdfUrl(options: {
  proofId: string;
  sourceBaseUrl: string;
  previewToken: string;
  entryPath?: string;
}) {
  const previewUrl = new URL(`/api/internal/proofs/${options.proofId}/pdf-preview`, options.sourceBaseUrl);
  previewUrl.searchParams.set('accessToken', options.previewToken);
  if (options.entryPath) {
    previewUrl.searchParams.set('entryPath', options.entryPath);
  }

  return previewUrl.toString();
}

export function isArchiveProofFile(fileName: string) {
  return extname(fileName).toLowerCase() === '.zip';
}

export function classifyProofPreview(fileName: string, options?: { allowArchive?: boolean }): ProofPreviewClassification {
  const extension = extname(fileName).toLowerCase();
  const allowArchive = options?.allowArchive ?? true;

  if (allowArchive && extension === '.zip') {
    return {
      mode: 'archive',
      contentType: 'application/zip'
    };
  }

  if (EXCEL_EXTENSIONS.has(extension)) {
    return {
      mode: 'kkfileview',
      contentType: null
    };
  }

  if (PDF_OFFICE_EXTENSIONS.has(extension)) {
    return {
      mode: 'kkfileview',
      officePreviewType: 'pdf',
      contentType: null
    };
  }

  return {
    mode: 'native',
    contentType: CONTENT_TYPES[extension] ?? null
  };
}

export function getProofContentType(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return CONTENT_TYPES[extension] ?? null;
}

export function buildSafeProofPreviewFileName(fileName: string, key: string) {
  const extension = extname(fileName).toLowerCase();
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 12);
  return `preview-${hash}${extension}`;
}
