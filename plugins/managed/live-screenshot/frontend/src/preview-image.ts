export interface PreviewImage {
  readonly element: HTMLImageElement;
  release(): void;
}

export async function decodePreview(blob: Blob, signal: AbortSignal): Promise<PreviewImage> {
  signal.throwIfAborted();
  if (blob.type !== 'image/png' || blob.size < 33 || blob.size > 8 * 1024 * 1024)
    throw new Error('media_preview_format_invalid');
  const bytes = new Uint8Array(await blob.slice(0, 33).arrayBuffer());
  signal.throwIfAborted();
  const header = new DataView(bytes.buffer);
  if (header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a ||
      header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452)
    throw new Error('media_preview_format_invalid');
  const width = header.getUint32(16), height = header.getUint32(20);
  if (!width || width > 8192 || !height || height > 360)
    throw new Error('media_preview_dimensions_invalid');
  const element = document.createElement('img');
  const url = URL.createObjectURL(blob);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    signal.removeEventListener('abort', release);
    element.removeAttribute('src');
    URL.revokeObjectURL(url);
  };
  signal.addEventListener('abort', release, { once: true });
  element.src = url;
  try {
    await element.decode();
    signal.throwIfAborted();
    if (element.naturalWidth !== width || element.naturalHeight !== height)
      throw new Error('media_preview_dimensions_invalid');
    return { element, release };
  } catch (error) { release(); throw error; }
}
