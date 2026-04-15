export function buildInlineContentDisposition(fileName: string) {
  const normalized = fileName.trim() || 'file';
  const asciiFallback = normalized
    .replace(/["\\]/g, '_')
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `inline; filename="${asciiFallback || 'file'}"; filename*=UTF-8''${encodeRFC5987Value(normalized)}`;
}

function encodeRFC5987Value(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
