type FileIdentity = { file: string };

export function galleryMediaPosition(collection: FileIdentity[], file: string): number {
  const index = collection.findIndex((item) => item.file === file);
  return index >= 0 ? index + 1 : 0;
}

export function resolveGalleryMediaIndex(
  collection: FileIdentity[],
  position: string | null,
  file: string | null,
): number {
  if (file) {
    const byFile = collection.findIndex((item) => item.file === file);
    if (byFile >= 0) return byFile;
  }
  const byPosition = Number(position) - 1;
  return Number.isInteger(byPosition) && byPosition >= 0 && collection[byPosition]
    ? byPosition
    : -1;
}
