const allGames = [
  { value: "timer", label: "按时间随机轮换" },
  { value: "startup", label: "每次启动 Web 随机轮换" },
  { value: "off", label: "不轮换" },
];

const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_ASSETS = 32;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

function assetName(asset) {
  return escapeHtml(asset.originalName || asset.id);
}

function renderCard(container, _context, host) {
  container.innerHTML = `<section class="settings-card section-surface wallpaper-settings-card" data-settings-panel="custom-wallpaper" data-testid="custom-wallpaper-card">
    <button class="settings-card-toggle" type="button" data-action="toggle-settings-panel" data-panel="custom-wallpaper" aria-expanded="false" aria-controls="settings-panel-custom-wallpaper"><span class="settings-card-copy"><strong class="settings-card-title">自定义壁纸</strong><span class="muted">同步壁纸、轮换方式和显示效果</span></span><span class="settings-card-arrow" aria-hidden="true">›</span></button>
    <div id="settings-panel-custom-wallpaper" class="settings-card-body" hidden>
      <div class="wallpaper-settings-body">
        <div class="wallpaper-status-row"><span class="muted">服务端同步到当前 NexusPipeline 实例的全部浏览器。</span><span class="badge muted" data-wallpaper-status>读取中</span></div>
        <div class="switch-row settings-option switch-card wallpaper-enabled-row">
          <div class="switch-copy"><strong>启用自定义壁纸</strong><span id="wallpaper-enabled-description" class="muted">启用后使用自定义壁纸作为页面背景。</span></div>
          <button class="mode-toggle switch-control" type="button" aria-label="启用自定义壁纸" aria-describedby="wallpaper-enabled-description" aria-pressed="false" data-state="off" data-toggle-text="false" data-wallpaper-enabled-toggle><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span><span class="sr-only" data-switch-state>已停用</span></button>
        </div>
        <div class="switch-row settings-option switch-card wallpaper-secondary-transparency-row">
          <div class="switch-copy"><strong>透明度运用于非主页面</strong><span id="wallpaper-secondary-transparency-description" class="muted">关闭后，二级浮层恢复为完全不透明；主页面一级卡片继续使用透明度设置。</span></div>
          <button class="mode-toggle switch-control" type="button" aria-label="透明度运用于非主页面" aria-describedby="wallpaper-secondary-transparency-description" aria-pressed="true" data-state="on" data-toggle-text="false" data-wallpaper-secondary-transparency-toggle><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span><span class="sr-only" data-switch-state>已启用</span></button>
        </div>
        <div class="form-grid wallpaper-controls">
          <div class="field wallpaper-mode-field" data-help="按时间随机轮换会按设定间隔切换壁纸；每次启动 Web 随机轮换只在服务启动后选择一次。"><span class="field-label">轮换方式</span>${host.controls.select({ id: "wallpaper-mode", value: "off", options: allGames, extra: "data-wallpaper-mode", ariaLabel: "轮换方式" })}</div>
          <div class="field" data-wallpaper-interval-field data-help="轮换方式为按时间随机轮换时生效，范围为 1 至 1440 分钟。"><span class="field-label">轮换间隔（分钟）</span>${host.controls.number({ id: "wallpaper-interval", value: 30, extra: 'min="1" max="1440" step="1" data-wallpaper-interval', ariaLabel: "轮换间隔（分钟）" })}</div>
        </div>
        <div class="form-grid wallpaper-effects">
          <div class="field" data-help="模糊范围为 0 至 40 像素。"><span class="field-label">模糊（像素）</span><span class="wallpaper-range-row">${host.controls.range({ id: "wallpaper-blur", value: 0, extra: 'min="0" max="40" step="1" data-wallpaper-blur', ariaLabel: "模糊（像素）" })}<output data-wallpaper-blur-value></output></span></div>
          <div class="field" data-help="变暗范围为 0 至 80%，用于调整壁纸与内容的对比度。"><span class="field-label">变暗</span><span class="wallpaper-range-row">${host.controls.range({ id: "wallpaper-dim", value: 20, extra: 'min="0" max="80" step="1" data-wallpaper-dim', ariaLabel: "变暗" })}<output data-wallpaper-dim-value></output></span></div>
          <div class="field" data-help="控制页面卡片、侧边栏和其他表面的透明度，范围为 0 至 50%。"><span class="field-label">卡片与侧边栏透明度</span><span class="wallpaper-range-row">${host.controls.range({ id: "wallpaper-surface-transparency", value: 0, extra: 'min="0" max="50" step="1" data-wallpaper-surface-transparency', ariaLabel: "卡片与侧边栏透明度" })}<output data-wallpaper-surface-transparency-value></output></span></div>
        </div>
        <div class="wallpaper-upload-row">${host.controls.file({ id: "wallpaper-files", accept: "image/jpeg,image/png,image/webp", multiple: true, extra: "data-wallpaper-files", label: "添加壁纸" })}<span class="muted">JPEG、PNG、WebP，单张最大 8192 KB</span></div>
        <div class="wallpaper-list" data-wallpaper-list></div>
        <div class="wallpaper-card-footer"><span class="muted" data-wallpaper-help>最多 32 张，实例总容量 256 MiB。</span></div>
      </div>
    </div>
  </section>`;
  const card = container.firstElementChild;
  const panelToggle = card.querySelector(".settings-card-toggle");
  const panelBody = card.querySelector(".settings-card-body");
  const panelArrow = card.querySelector(".settings-card-arrow");
  const enabledToggle = card.querySelector("[data-wallpaper-enabled-toggle]");
  const secondaryTransparencyToggle = card.querySelector("[data-wallpaper-secondary-transparency-toggle]");
  const mode = card.querySelector("[data-wallpaper-mode]");
  const interval = card.querySelector("[data-wallpaper-interval]");
  const blur = card.querySelector("[data-wallpaper-blur]");
  const dim = card.querySelector("[data-wallpaper-dim]");
  const surfaceTransparency = card.querySelector("[data-wallpaper-surface-transparency]");
  const list = card.querySelector("[data-wallpaper-list]");
  const status = card.querySelector("[data-wallpaper-status]");
  const help = card.querySelector("[data-wallpaper-help]");
  const defaultHelp = help.textContent;
  let snapshot = null;
  let saveTimer = null;
  let savePromise = Promise.resolve();
  let lastSavedSignature = "";
  let draggedItem = null;
  let draggedId = "";

  const currentOrder = () => [...list.querySelectorAll("[data-wallpaper-id]")]
    .map(item => item.dataset.wallpaperId)
    .filter(Boolean);
  const readSettings = () => ({
    order: currentOrder(),
    selectedId: snapshot?.selectedId || "",
    rotation: {
      mode: mode.value,
      intervalMinutes: Number(interval.value) || 30,
      epochUnixMs: snapshot?.rotation?.epochUnixMs || Date.now(),
    },
    effects: {
      blurPx: Number(blur.value) || 0,
      dimPercent: Number(dim.value) || 0,
      surfaceTransparencyPercent: Number(surfaceTransparency.value) || 0,
      applyTransparencyToSecondarySurfaces: secondaryTransparencyToggle.getAttribute("aria-pressed") === "true",
    },
    provider: { enabled: enabledToggle.getAttribute("aria-pressed") === "true" },
  });
  const settingsSignature = settings => JSON.stringify(settings);
  const requestSave = () => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      savePromise = savePromise.then(save).catch(() => {});
    }, 0);
  };

  const setStatus = (message, tone = "muted") => {
    status.textContent = message;
    status.className = `badge ${tone}`;
  };
  const syncEnabled = () => {
    const on = enabledToggle.getAttribute("aria-pressed") === "true";
    enabledToggle.dataset.state = on ? "on" : "off";
    enabledToggle.querySelector("[data-switch-state]").textContent = on ? "已启用" : "已停用";
  };
  const syncSecondaryTransparency = () => {
    const on = secondaryTransparencyToggle.getAttribute("aria-pressed") === "true";
    secondaryTransparencyToggle.dataset.state = on ? "on" : "off";
    secondaryTransparencyToggle.querySelector("[data-switch-state]").textContent = on ? "已启用" : "已停用";
  };
  const syncLabels = () => {
    card.querySelector("[data-wallpaper-blur-value]").textContent = `${blur.value}px`;
    card.querySelector("[data-wallpaper-dim-value]").textContent = `${dim.value}%`;
    card.querySelector("[data-wallpaper-surface-transparency-value]").textContent = `${surfaceTransparency.value}%`;
  };
  const syncFallbackPanel = expanded => {
    card.classList.toggle("is-expanded", expanded);
    panelToggle.setAttribute("aria-expanded", String(expanded));
    panelBody.hidden = !expanded;
    if (panelArrow) panelArrow.textContent = expanded ? "⌄" : "›";
  };
  const renderList = () => {
    const assets = snapshot?.assets || [];
    if (!assets.length) {
      list.innerHTML = `<p class="muted wallpaper-empty">尚未添加壁纸。</p>`;
      return;
    }
    const byId = new Map(assets.map(asset => [asset.id, asset]));
    const order = [...new Set([...(Array.isArray(snapshot.order) ? snapshot.order : []), ...assets.map(asset => asset.id)])]
      .filter(id => byId.has(id));
    list.innerHTML = order.map(id => {
      const asset = byId.get(id);
      if (!asset) return "";
      const escapedId = escapeHtml(asset.id);
      return `<div class="wallpaper-item" data-wallpaper-id="${escapedId}"><button class="wallpaper-drag-handle" type="button" draggable="true" data-wallpaper-drag-handle="${escapedId}" aria-label="拖拽排序：${assetName(asset)}" title="拖拽排序">⠿</button><img src="${escapeHtml(asset.url)}" alt="${assetName(asset)}"><div class="wallpaper-item-copy"><strong>${assetName(asset)}</strong><span class="muted">${formatBytes(asset.sizeBytes)}</span></div><div class="wallpaper-item-actions"><button class="ghost danger" type="button" data-wallpaper-remove="${escapedId}">删除</button></div></div>`;
    }).join("");
  };
  const load = async () => {
    try {
      snapshot = await host.appearance.wallpaperStore.get();
      enabledToggle.setAttribute("aria-pressed", String(snapshot.provider?.enabled === true));
      syncEnabled();
      secondaryTransparencyToggle.setAttribute("aria-pressed", String(snapshot.effects?.applyTransparencyToSecondarySurfaces !== false));
      syncSecondaryTransparency();
      mode.value = snapshot.rotation?.mode || "off";
      interval.value = snapshot.rotation?.intervalMinutes || 30;
      blur.value = snapshot.effects?.blurPx || 0;
      dim.value = snapshot.effects?.dimPercent ?? 20;
      surfaceTransparency.value = Math.max(0, Math.min(50, Number(snapshot.effects?.surfaceTransparencyPercent) || 0));
      renderList();
      syncLabels();
      lastSavedSignature = settingsSignature(readSettings());
      setStatus(snapshot.effectiveEnabled ? "已启用" : "未启用", snapshot.effectiveEnabled ? "ok" : "muted");
    } catch (error) {
      setStatus("读取失败", "bad");
      help.textContent = error.message;
    }
  };
  const save = async () => {
    if (!snapshot) return;
    const settings = readSettings();
    const signature = settingsSignature(settings);
    if (signature === lastSavedSignature) return;
    try {
      setStatus("保存中", "blue");
      snapshot = await host.appearance.wallpaperStore.save(settings);
      lastSavedSignature = signature;
      setStatus(snapshot.effectiveEnabled ? "已启用" : "未启用", snapshot.effectiveEnabled ? "ok" : "muted");
    } catch (error) {
      setStatus("保存失败", "bad");
      help.textContent = error.message;
    }
  };
  enabledToggle.addEventListener("click", () => {
    const next = enabledToggle.getAttribute("aria-pressed") !== "true";
    enabledToggle.setAttribute("aria-pressed", String(next));
    syncEnabled();
    requestSave();
  });
  secondaryTransparencyToggle.addEventListener("click", () => {
    const next = secondaryTransparencyToggle.getAttribute("aria-pressed") !== "true";
    secondaryTransparencyToggle.setAttribute("aria-pressed", String(next));
    syncSecondaryTransparency();
    requestSave();
  });
  panelToggle.addEventListener("click", () => {
    const expected = panelToggle.getAttribute("aria-expanded") !== "true";
    setTimeout(() => {
      const actual = panelToggle.getAttribute("aria-expanded") === "true" && !panelBody.hidden;
      if (actual === expected) return;
      if (expected) {
        document.querySelectorAll("[data-settings-panel]").forEach(other => {
          if (other === card) return;
          other.classList.remove("is-expanded");
          other.querySelector(".settings-card-toggle")?.setAttribute("aria-expanded", "false");
          const body = other.querySelector(".settings-card-body");
          if (body) body.hidden = true;
          const arrow = other.querySelector(".settings-card-arrow");
          if (arrow) arrow.textContent = "›";
        });
      }
      syncFallbackPanel(expected);
    }, 0);
  });
  card.addEventListener("input", syncLabels);
  const clearDragState = () => {
    draggedItem?.classList.remove("is-dragging");
    list.querySelectorAll(".is-drag-over").forEach(item => item.classList.remove("is-drag-over"));
    draggedItem = null;
    draggedId = "";
  };
  list.addEventListener("dragstart", event => {
    const source = event.target instanceof Element ? event.target : null;
    const handle = source?.closest("[data-wallpaper-drag-handle]");
    if (!handle || !list.contains(handle)) {
      event.preventDefault();
      return;
    }
    draggedItem = handle.closest(".wallpaper-item");
    draggedId = draggedItem?.dataset.wallpaperId || "";
    if (!draggedItem || !draggedId) {
      event.preventDefault();
      clearDragState();
      return;
    }
    draggedItem.classList.add("is-dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedId);
    }
  });
  list.addEventListener("dragover", event => {
    const source = event.target instanceof Element ? event.target : null;
    const target = source?.closest(".wallpaper-item");
    if (!draggedItem || !target || target === draggedItem || !list.contains(target)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const rect = target.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    const insertionPoint = after ? target.nextElementSibling : target;
    if (insertionPoint !== draggedItem) list.insertBefore(draggedItem, insertionPoint);
    list.querySelectorAll(".is-drag-over").forEach(item => item.classList.remove("is-drag-over"));
    target.classList.add("is-drag-over");
  });
  list.addEventListener("drop", event => {
    if (!draggedItem) return;
    event.preventDefault();
    snapshot.order = currentOrder();
    clearDragState();
    renderList();
    requestSave();
  });
  list.addEventListener("dragend", clearDragState);
  card.addEventListener("change", async event => {
    if (!event.target.matches("[data-wallpaper-files]")) return;
    const files = Array.from(event.target.files || []);
    let uploadedCount = 0;
    let failedCount = 0;
    let paletteWarningCount = 0;
    for (const file of files) {
      if (!ALLOWED_TYPES.has(String(file.type || "").toLowerCase())) {
        failedCount++;
        const message = "壁纸仅支持 JPEG、PNG 或 WebP";
        help.textContent = message;
        host.ui.toast(message, "error");
        continue;
      }
      if (file.size > MAX_ASSET_BYTES) {
        failedCount++;
        const message = "壁纸文件不能超过 8192 KB";
        help.textContent = message;
        host.ui.toast(message, "error");
        continue;
      }
      if ((snapshot?.assets?.length || 0) >= MAX_ASSETS) {
        failedCount++;
        const message = "壁纸数量不能超过 32 张";
        help.textContent = message;
        host.ui.toast(message, "error");
        continue;
      }
      try {
        const bitmap = await createImageBitmap(file);
        const portrait = bitmap.height > bitmap.width;
        bitmap.close?.();
        if (portrait) host.ui.toast("该图片可能在电脑上显示效果不佳", "warn");
      } catch {
        // 图片尺寸解析失败交由服务端图片头校验处理。
      }
      let uploaded;
      try {
        setStatus(`上传中：${file.name}`, "blue");
        const result = await host.appearance.wallpaperStore.upload(file, { name: file.name });
        uploaded = result?.asset;
        if (!uploaded?.id) throw new Error("上传接口未返回壁纸资源");
        uploadedCount++;
        await load();
      } catch (error) {
        failedCount++;
        setStatus("上传失败", "bad");
        help.textContent = error.message;
        await load();
        continue;
      }
      try {
        const palette = await host.appearance.derivePalette(file);
        await host.appearance.wallpaperStore.savePalette(uploaded.id, palette);
      } catch (error) {
        paletteWarningCount++;
        help.textContent = `壁纸已上传，配色稍后生成：${error.message}`;
      }
      await load();
    }
    event.target.value = "";
    if (uploadedCount > 0) {
      const suffix = failedCount > 0 ? `，${failedCount} 张失败` : "";
      const paletteSuffix = paletteWarningCount > 0 ? "（配色待生成）" : "";
      setStatus(`已上传 ${uploadedCount} 张${suffix}${paletteSuffix}`, failedCount > 0 || paletteWarningCount > 0 ? "warn" : "ok");
      if (failedCount === 0 && paletteWarningCount === 0) help.textContent = defaultHelp;
    } else if (files.length > 0) {
      setStatus("上传失败", "bad");
    }
  });
  [mode, interval, blur, dim, surfaceTransparency].forEach(control => {
    control.addEventListener("change", () => {
      syncLabels();
      requestSave();
    });
    control.addEventListener("blur", requestSave);
  });
  enabledToggle.addEventListener("blur", requestSave);
  secondaryTransparencyToggle.addEventListener("blur", requestSave);
  card.addEventListener("click", async event => {
    const remove = event.target.closest("[data-wallpaper-remove]");
    if (remove) {
      try { await host.appearance.wallpaperStore.remove(remove.dataset.wallpaperRemove); await load(); } catch (error) { setStatus("删除失败", "bad"); }
      return;
    }
  });
  load();
  const subscription = host.appearance.wallpaperStore.subscribe(next => { if (next?.revision !== snapshot?.revision) load(); });
  return () => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    subscription.dispose();
  };
}

export function activate(host) {
  return host.slots.register("settings.cards", renderCard);
}
