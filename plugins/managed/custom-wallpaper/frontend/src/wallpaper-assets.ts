import { bindLocale } from '../../../frontend-ui/src/localize.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { button, type Panel } from '../../../frontend-ui/src/elements.js';
import { boundedImage } from '../../../frontend-ui/src/image-bound.js';
import { derivePalette } from './palette.js';
import type { WallpaperPorts, WallpaperState } from './ports.js';

interface AssetRow {
  element: HTMLElement;
  picture: HTMLImageElement;
  owner: AbortController;
  fingerprint: string;
}
export class WallpaperAssets {
  private readonly list = document.createElement('nexus-sortable-list') as UiElement<'nexus-sortable-list'>;
  private readonly empty = document.createElement('p');
  private readonly limits = document.createElement('p');
  private readonly help = document.createElement('span');
  private readonly picker = document.createElement('nexus-file-picker') as UiElement<'nexus-file-picker'>;
  private readonly rows = new Map<string, AssetRow>();
  private readonly images = new Map<string, { size: number; url: string }>();
  private readonly observer: IntersectionObserver;
  private readonly queued: string[] = [];
  private readonly loading = new Set<string>();
  private visible = false;
  private generation = 0;
  private request = new AbortController();
  private uploading = false;
  constructor(
    private readonly panel: Panel,
    parent: HTMLElement,
    private readonly ports: WallpaperPorts,
    private readonly state: () => WallpaperState | undefined,
    private readonly publish: (state: WallpaperState) => Promise<void>,
    private readonly reorder: (ids: string[]) => void
  ) {
    const uploadRow = document.createElement('div');
    uploadRow.className = 'wallpaper-upload';
    const picker = this.picker;
    picker.accept = 'image/jpeg,image/png,image/webp';
    picker.multiple = true;
    bindLocale(panel.t, panel.signal, picker, 'aria-label', () => {
      picker.setAttribute('aria-label', panel.t('添加壁纸'));
    });
    picker.addEventListener(
      'nexus-change',
      (event) => {
        void panel.run(() => this.upload((event as CustomEvent<{ value: File[] }>).detail.value));
      },
      { signal: panel.signal }
    );
    uploadRow.append(picker, this.help);
    this.list.className = 'wallpaper-list';
    bindLocale(panel.t, panel.signal, this.list, 'aria-label', () => {
      this.list.setAttribute('aria-label', panel.t('壁纸顺序'));
    });
    this.empty.className = 'wallpaper-empty';
    bindLocale(panel.t, panel.signal, this.empty, 'textContent', () => {
      this.empty.textContent = panel.t('尚未添加壁纸。');
    });
    this.limits.className = 'wallpaper-limits';
    parent.append(uploadRow, this.list, this.limits);
    this.list.addEventListener(
      'nexus-reorder',
      (event) => {
        const ids = (event as CustomEvent<{ ids: string[] }>).detail.ids;
        if (
          ids.length === this.rows.size &&
          new Set(ids).size === ids.length &&
          ids.every((id) => this.rows.has(id))
        )
          this.reorder(ids);
      },
      { signal: panel.signal }
    );
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries)
        if (entry.isIntersecting && this.visible) {
          this.observer.unobserve(entry.target);
          this.queued.push((entry.target as HTMLElement).dataset.itemId!);
        }
      this.pump();
    });
  }

  render(state: WallpaperState | undefined): void {
    if (!state) return;
    const ids = [...new Set([...state.order, ...state.assets.map((asset) => asset.id)])].filter((id) =>
      state.assets.some((asset) => asset.id === id)
    );
    for (const [id, row] of this.rows)
      if (!ids.includes(id)) {
        row.owner.abort();
        this.observer.unobserve(row.element);
        row.element.remove();
        this.rows.delete(id);
        this.release(id);
      }
    ids.forEach((id, index) => {
      const asset = state.assets.find((item) => item.id === id)!,
        fingerprint = JSON.stringify([asset.name, asset.sizeBytes]);
      let row = this.rows.get(id);
      if (row?.fingerprint !== fingerprint) {
        row?.owner.abort();
        row?.element.remove();
        this.release(id);
        row = this.createRow(id, asset.name, asset.sizeBytes, fingerprint);
        this.rows.set(id, row);
        if (this.visible) this.observer.observe(row.element);
      }
      if (this.list.children[index] !== row!.element)
        this.list.insertBefore(row!.element, this.list.children[index] || null);
    });
    this.list.ids = ids;
    if (ids.length) this.empty.remove();
    else this.list.append(this.empty);
    const limits = state.limits || { maxAssetBytes: 8388608, maxAssets: 32, maxTotalBytes: 268435456 };
    bindLocale(this.panel.t, this.panel.signal, this.help, 'textContent', () => {
      this.help.textContent = this.panel
        .t('JPEG、PNG、WebP，单张最大 {size} KB')
        .replace('{size}', String(Math.floor(limits.maxAssetBytes / 1024)));
    });
    bindLocale(this.panel.t, this.panel.signal, this.limits, 'textContent', () => {
      this.limits.textContent = this.panel
        .t('最多 {count} 张，实例总容量 {size} MiB。')
        .replace('{count}', String(limits.maxAssets))
        .replace('{size}', String(Math.floor(limits.maxTotalBytes / 1048576)));
    });
  }

  private createRow(id: string, name: string, size: number, fingerprint: string): AssetRow {
    const owner = new AbortController(),
      panel = { ...this.panel, signal: AbortSignal.any([this.panel.signal, owner.signal]) };
    const element = document.createElement('div');
    element.className = 'wallpaper-item';
    element.dataset.itemId = id;
    const handle = document.createElement('nexus-drag-handle') as UiElement<'nexus-drag-handle'>;
    handle.itemId = id;
    bindLocale(panel.t, panel.signal, handle, 'label', () => {
      handle.label = this.panel.t('拖拽排序') + '：' + name;
    });
    const picture = document.createElement('img');
    picture.alt = name;
    picture.width = 72;
    picture.height = 44;
    const thumbnail = document.createElement('span');
    thumbnail.className = 'wallpaper-thumbnail';
    thumbnail.append(picture);
    const copy = document.createElement('div');
    copy.className = 'wallpaper-item-copy';
    const title = document.createElement('strong'),
      metadata = document.createElement('span');
    title.textContent = name;
    metadata.textContent =
      size < 1024
        ? size + ' B'
        : size < 1048576
          ? Math.round(size / 1024) + ' KiB'
          : (size / 1048576).toFixed(1) + ' MiB';
    copy.append(title, metadata);
    element.append(handle, thumbnail, copy);
    const remove = button(panel, element, '删除', async () => {
      const control = remove as UiElement<'nexus-button'>;
      if (control.busy) return;
      control.busy = true;
      try {
        const next = await this.ports.deleteAsset(id, panel.signal);
        if (panel.alive()) await this.publish(next);
      } finally {
        control.busy = false;
      }
    }) as UiElement<'nexus-button'>;
    remove.tone = 'danger';
    return { element, picture, owner, fingerprint };
  }

  private pump(): void {
    while (this.visible && this.loading.size < 4 && this.queued.length) {
      const id = this.queued.shift()!;
      if (this.loading.has(id) || !this.rows.has(id)) continue;
      const generation = this.generation;
      this.loading.add(id);
      void this.load(id, generation).finally(() => {
        if (generation === this.generation) {
          this.loading.delete(id);
          this.pump();
        }
      });
    }
  }
  private async load(id: string, generation: number): Promise<void> {
    try {
      const row = this.rows.get(id),
        asset = this.state()?.assets.find((item) => item.id === id);
      if (!row || !asset) return;
      const cached = this.images.get(id);
      if (cached?.size === asset.sizeBytes) {
        row.picture.src = cached.url;
        return;
      }
      const signal = AbortSignal.any([this.panel.signal, this.request.signal, row.owner.signal]);
      const blob = await boundedImage(await this.ports.readAsset(id, signal));
      if (!this.panel.alive() || !this.visible || generation !== this.generation || signal.aborted) return;
      const url = URL.createObjectURL(blob);
      this.images.set(id, { size: asset.sizeBytes, url });
      row.picture.src = url;
    } catch {
      /* The filename remains usable when a thumbnail cannot be read. */
    }
  }
  private release(id: string): void {
    const image = this.images.get(id);
    if (image) URL.revokeObjectURL(image.url);
    this.images.delete(id);
  }
  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.generation++;
    this.request.abort();
    this.request = new AbortController();
    this.queued.length = 0;
    this.loading.clear();
    this.observer.disconnect();
    for (const [id, row] of this.rows) {
      if (visible) this.observer.observe(row.element);
      else {
        row.picture.removeAttribute('src');
        this.release(id);
      }
    }
  }

  private async upload(files: File[]): Promise<void> {
    if (this.uploading) return;
    this.uploading = true;
    this.picker.disabled = true;
    try {
      for (const file of files) {
        if (!this.panel.alive()) return;
        this.validate(file);
        try {
          const bitmap = await createImageBitmap(file);
          const portrait = bitmap.height > bitmap.width;
          bitmap.close();
          if (portrait) this.panel.say('该图片可能在电脑上显示效果不佳');
        } catch {
          /* The upload port owns format validation. */
        }
        const prior = new Set(this.state()?.assets.map((asset) => asset.id));
        const next = await this.ports.uploadAsset(file, this.panel.signal);
        if (!this.panel.alive()) return;
        await this.publish(next);
        const added = next.assets.find((asset) => !prior.has(asset.id));
        if (added && !added.palette)
          try {
            const palette = await derivePalette(file);
            if (!this.panel.alive()) return;
            await this.publish(await this.ports.savePalette(added.id, palette, this.panel.signal));
          } catch {
            if (this.panel.alive()) this.panel.say('壁纸已上传，配色稍后生成', true);
          }
      }
    } finally {
      this.uploading = false;
      this.picker.disabled = false;
    }
  }
  private validate(file: File): void {
    const state = this.state(),
      limits = state?.limits;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      throw Error('壁纸仅支持 JPEG、PNG 或 WebP');
    if (file.size > (limits?.maxAssetBytes || 8388608)) throw Error('壁纸文件过大');
  }
  dispose(): void {
    this.setVisible(false);
    this.request.abort();
    this.observer.disconnect();
    for (const row of this.rows.values()) row.owner.abort();
    this.rows.clear();
    for (const id of this.images.keys()) this.release(id);
  }
}
