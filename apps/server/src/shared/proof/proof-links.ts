export type ProofLinkOptions = {
  proofId: string;
  fileName: string;
  sourceBaseUrl: string;
  previewBaseUrl: string;
  previewToken: string;
};

export function buildProofDownloadUrl(proofId: string) {
  return `/employee/proofs/${proofId}/download`;
}

export function buildProofPreviewUrl(options: ProofLinkOptions) {
  const sourceUrl = new URL(`/api/internal/proofs/${options.proofId}/source`, options.sourceBaseUrl);
  sourceUrl.searchParams.set('accessToken', options.previewToken);
  sourceUrl.searchParams.set('fullfilename', options.fileName);

  const encodedSourceUrl = encodeURIComponent(Buffer.from(sourceUrl.toString(), 'utf8').toString('base64'));
  const normalizedPreviewBaseUrl = options.previewBaseUrl.replace(/\/+$/, '');

  return `${normalizedPreviewBaseUrl}/onlinePreview?url=${encodedSourceUrl}`;
}
