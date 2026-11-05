function hue(red: number, green: number, blue: number) {
  const [r, g, b] = [red, green, blue].map((value) => value / 255);
  const largest = Math.max(r, g, b);
  const smallest = Math.min(r, g, b);
  const spread = largest - smallest;
  const light = (largest + smallest) / 2;
  const saturation = spread ? (spread / (1 - Math.abs(2 * light - 1))) * 100 : 0;
  let angle = 0;
  if (spread && largest === r) angle = ((g - b) / spread) % 6;
  else if (spread && largest === g) angle = (b - r) / spread + 2;
  else if (spread) angle = (r - g) / spread + 4;
  return { angle: (angle * 60 + 360) % 360, saturation, light };
}

export function accentHex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  const parts = /^hsl\((\d{1,3}) (\d{1,3})% (\d{1,3})%\)$/.exec(value);
  if (!parts) return undefined;
  const angle = Number(parts[1]);
  const saturation = Number(parts[2]) / 100;
  const light = Number(parts[3]) / 100;
  if (angle > 360 || saturation > 1 || light > 1) return undefined;
  const chroma = (1 - Math.abs(2 * light - 1)) * saturation;
  const sector = angle / 60;
  const middle = chroma * (1 - Math.abs((sector % 2) - 1));
  const channels =
    sector < 1
      ? [chroma, middle, 0]
      : sector < 2
        ? [middle, chroma, 0]
        : sector < 3
          ? [0, chroma, middle]
          : sector < 4
            ? [0, middle, chroma]
            : sector < 5
              ? [middle, 0, chroma]
              : [chroma, 0, middle];
  const offset = light - chroma / 2;
  return (
    '#' +
    channels
      .map((channel) =>
        Math.round((channel + offset) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

export async function derivePalette(blob: Blob): Promise<Record<string, string>> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error('无法读取图片像素');
  }
  context.drawImage(bitmap, 0, 0, 64, 64);
  bitmap.close();
  const pixels = context.getImageData(0, 0, 64, 64).data;
  const totals = [0, 0, 0];
  let weight = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    for (let channel = 0; channel < 3; channel++) totals[channel] += pixels[index + channel] * alpha;
    weight += alpha;
  }
  const [red, green, blue] = totals.map((value) => Math.round(value / Math.max(1, weight)));
  const { angle, saturation, light } = hue(red, green, blue);
  const dark = light < 0.5;
  const accentSaturation = Math.max(48, Math.min(78, saturation + 18));
  const cardSaturation = Math.max(10, Math.min(32, saturation * 0.34 + 8));
  const hsl = (h: number, s: number, l: number) =>
    `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  const alpha = (h: number, s: number, l: number, a: number) =>
    `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${a})`;
  return {
    '--accent': hsl(angle, accentSaturation, dark ? 66 : 42),
    '--accent-strong': hsl(angle, Math.min(84, accentSaturation + 6), dark ? 74 : 34),
    '--accent-alt': hsl((angle + 32) % 360, 64, dark ? 68 : 38),
    '--accent-soft': alpha(angle, accentSaturation, dark ? 66 : 42, dark ? 0.2 : 0.18),
    '--on-accent': '#ffffff',
    '--mask': dark ? 'rgba(4, 10, 20, .44)' : 'rgba(255, 255, 255, .42)',
    '--focus': `0 0 0 3px ${alpha(angle, accentSaturation, dark ? 66 : 42, 0.32)}`,
    '--wallpaper-card-dark': hsl(angle, cardSaturation, 16),
    '--wallpaper-card-dark-soft': hsl(angle, cardSaturation + 2, 21),
    '--wallpaper-card-dark-hover': hsl(angle, cardSaturation + 5, 26),
    '--wallpaper-card-dark-border': alpha(angle, cardSaturation + 10, 64, 0.32),
    '--wallpaper-card-light': hsl(angle, cardSaturation, 97),
    '--wallpaper-card-light-soft': hsl(angle, cardSaturation + 2, 93),
    '--wallpaper-card-light-hover': hsl(angle, cardSaturation + 5, 89),
    '--wallpaper-card-light-border': alpha(angle, cardSaturation + 10, 42, 0.24)
  };
}
