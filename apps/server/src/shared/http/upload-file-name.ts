const MOJIBAKE_PATTERN = /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/;
const CJK_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]/;

export function normalizeUploadedFileName(fileName: string) {
  const normalized = fileName.trim();
  if (!normalized) {
    return fileName;
  }

  const decoded = Buffer.from(normalized, 'latin1').toString('utf8').trim();
  if (!decoded || decoded.includes('\uFFFD')) {
    return normalized;
  }

  if (!MOJIBAKE_PATTERN.test(normalized)) {
    return normalized;
  }

  if (CJK_PATTERN.test(decoded) || decoded.includes('—') || decoded.includes('（') || decoded.includes('）')) {
    return decoded;
  }

  return normalized;
}
