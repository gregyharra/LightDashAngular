export function getLoomShareId(url: string | undefined): string | undefined {
  const match = url?.match(/share\/([^/?#]+)/);
  return match?.[1];
}

export function getLoomEmbedUrl(url: string | undefined): string | null {
  const shareId = getLoomShareId(url);
  return shareId ? `https://www.loom.com/embed/${shareId}` : null;
}

export function isValidLoomUrl(url: string | undefined): boolean {
  return !!getLoomShareId(url);
}
