const MEGABYTE = 1024 * 1024;
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export async function boundedImage(blob: Blob, maxBytes = 8 * MEGABYTE): Promise<Blob> {
  if (blob.size === 0 || blob.size > maxBytes || !imageTypes.has(blob.type))
    throw new Error('图片格式或大小不符合预览限制');
  if (blob.type === 'image/png') {
    const header = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
    if (header.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte))
      throw new Error('PNG 图片无效');
    const dimensions = new DataView(header.buffer);
    const width = dimensions.getUint32(16); const height = dimensions.getUint32(20);
    if (!width || !height || width * height * 4 > 64 * MEGABYTE) throw new Error('图片像素超过预览限制');
  }
  const bitmap = await createImageBitmap(blob);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height * 4 > 64 * MEGABYTE)
      throw new Error('图片像素超过预览限制');
  } finally { bitmap.close(); }
  return blob;
}
