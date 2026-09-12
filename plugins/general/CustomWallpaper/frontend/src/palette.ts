/**
 * 插件自有的自适应配色推导：取缩略图平均色与主色，生成完整实色 CSS token，
 * 避免透明层叠造成文字边界不清。
 */
function hslToCss(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function hslAlphaToCss(h: number, s: number, l: number, alpha: number): string {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${alpha})`;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (max + min) / 2; const delta = max - min;
  if (delta) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return [(h + 360) % 360, s * 100, l * 100];
}

export async function derivePalette(blob: Blob): Promise<Record<string, string>> {
  if (!(blob instanceof Blob)) throw new TypeError("壁纸数据无效");
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close?.();
    throw new Error("无法读取壁纸像素");
  }
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close?.();
  const pixels = context.getImageData(0, 0, size, size).data;
  let red = 0; let green = 0; let blue = 0; let weight = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    red += pixels[i] * alpha; green += pixels[i + 1] * alpha; blue += pixels[i + 2] * alpha; weight += alpha;
  }
  red = Math.round(red / Math.max(1, weight));
  green = Math.round(green / Math.max(1, weight));
  blue = Math.round(blue / Math.max(1, weight));
  const light = relativeLuminance(red, green, blue) < 0.42;
  const [hue, saturation] = rgbToHsl(red, green, blue);
  const cardSaturation = Math.max(10, Math.min(32, saturation * 0.34 + 8));
  const accent = hslToCss(hue, Math.max(48, Math.min(78, saturation + 18)), light ? 66 : 42);
  const accentStrong = hslToCss(hue, Math.max(52, Math.min(84, saturation + 25)), light ? 74 : 34);
  return {
    "--accent": accent,
    "--accent-strong": accentStrong,
    "--accent-alt": hslToCss((hue + 32) % 360, 64, light ? 68 : 38),
    "--accent-soft": hslAlphaToCss(hue, Math.max(48, Math.min(78, saturation + 18)), light ? 66 : 42, light ? 0.2 : 0.18),
    "--on-accent": "#ffffff",
    "--mask": light ? "rgba(4, 10, 20, .44)" : "rgba(255, 255, 255, .42)",
    "--focus": `0 0 0 3px ${hslAlphaToCss(hue, Math.max(48, Math.min(78, saturation + 18)), light ? 66 : 42, 0.32)}`,
    "--wallpaper-card-dark": hslToCss(hue, cardSaturation, 16),
    "--wallpaper-card-dark-soft": hslToCss(hue, Math.min(36, cardSaturation + 2), 21),
    "--wallpaper-card-dark-hover": hslToCss(hue, Math.min(40, cardSaturation + 5), 26),
    "--wallpaper-card-dark-border": hslAlphaToCss(hue, Math.min(44, cardSaturation + 10), 64, 0.32),
    "--wallpaper-card-light": hslToCss(hue, cardSaturation, 97),
    "--wallpaper-card-light-soft": hslToCss(hue, Math.min(36, cardSaturation + 2), 93),
    "--wallpaper-card-light-hover": hslToCss(hue, Math.min(40, cardSaturation + 5), 89),
    "--wallpaper-card-light-border": hslAlphaToCss(hue, Math.min(44, cardSaturation + 10), 42, 0.24),
  };
}
