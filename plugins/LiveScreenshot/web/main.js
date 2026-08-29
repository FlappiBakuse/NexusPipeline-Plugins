function previewTime(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("zh-CN", { hour12: false });
}

function renderPreview(container, context, host) {
  const runId = String(context?.primaryId || "").trim();
  container.innerHTML = `<section class="live-screenshot-card" data-live-screenshot-card>
    <div class="live-screenshot-heading"><strong>实时画面</strong><span class="badge muted" data-live-screenshot-source>等待</span></div>
    <div class="live-screenshot-stage" data-live-screenshot-stage><span class="muted" data-live-screenshot-state>等待任务画面</span></div>
    <div class="live-screenshot-footer"><span class="muted" data-live-screenshot-time></span><span class="muted">每 5 秒更新</span></div>
  </section>`;
  const card = container.firstElementChild;
  const stage = card.querySelector("[data-live-screenshot-stage]");
  const state = card.querySelector("[data-live-screenshot-state]");
  const source = card.querySelector("[data-live-screenshot-source]");
  const capturedAt = card.querySelector("[data-live-screenshot-time]");
  let timer = null;
  let request = null;
  let objectUrl = null;
  let disposed = false;

  const releaseObjectUrl = () => {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };
  const setState = (message, tone = "muted") => {
    releaseObjectUrl();
    stage.replaceChildren();
    const text = document.createElement("span");
    text.className = `muted live-screenshot-${tone}`;
    text.textContent = message;
    stage.append(text);
    source.textContent = "等待";
    source.className = "badge muted";
    capturedAt.textContent = "";
  };
  const setImage = result => {
    const image = document.createElement("img");
    image.src = result.url;
    image.alt = "当前游戏画面";
    image.className = "live-screenshot-image";
    stage.replaceChildren(image);
    releaseObjectUrl();
    objectUrl = result.url;
    capturedAt.textContent = result.capturedAt ? `最近更新 ${previewTime(result.capturedAt)}` : "";
    source.textContent = result.source === "emulator" ? "模拟器" : "PC 游戏";
    source.className = "badge ok";
  };
  const capture = async () => {
    if (disposed || request || !runId) return;
    request = new AbortController();
    try {
      const result = await host.executionPreview.capture(runId, request.signal);
      if (disposed) return;
      if (result.state === "ready" && result.url) {
        setImage(result);
      } else if (result.state === "waiting_for_game") {
        setState("正在等待游戏窗口…");
      } else if (result.state === "window_not_ready") {
        setState("正在等待游戏窗口…");
      } else if (result.state === "emulator_not_ready") {
        setState("正在等待模拟器画面…");
      } else {
        setState("等待任务画面");
      }
    } catch (error) {
      if (!disposed && error?.name !== "AbortError") setState("暂时无法获取游戏窗口画面", "error");
    } finally {
      request = null;
    }
  };

  capture();
  timer = setInterval(capture, 5000);
  return () => {
    disposed = true;
    if (timer !== null) clearInterval(timer);
    request?.abort();
    releaseObjectUrl();
  };
}

export function activate(host) {
  return host.slots.register("dispatch.running.sidecar", renderPreview);
}
