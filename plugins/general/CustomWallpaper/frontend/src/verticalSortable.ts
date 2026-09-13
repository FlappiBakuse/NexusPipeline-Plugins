export interface VerticalSortableOptions {
  handleSelector: string;
  onDrop?: (ids: string[], movedId: string) => void | Promise<void>;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}

interface ActiveDrag {
  item: HTMLElement;
  pointerId: number;
  startY: number;
  initialOrder: string[];
  moved: boolean;
  placeBefore: HTMLElement | null;
  previousTransform: string;
  previousZIndex: string;
  previousWillChange: string;
}

function directItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.matches("[data-dnd-id]"),
  );
}

function itemIds(container: HTMLElement): string[] {
  return directItems(container)
    .map(item => item.dataset.dndId || "")
    .filter(Boolean);
}

function itemFromHandle(container: HTMLElement, target: EventTarget | null, handleSelector: string): HTMLElement | null {
  const handle = target instanceof Element ? target.closest<HTMLElement>(handleSelector) : null;
  if (!handle || !container.contains(handle)) return null;
  const item = handle.closest<HTMLElement>("[data-dnd-id]");
  return item && item.parentElement === container ? item : null;
}

function isDisabled(handle: Element | null): boolean {
  return Boolean(handle?.hasAttribute("disabled") || handle?.getAttribute("aria-disabled") === "true");
}

function placeBeforeForPoint(container: HTMLElement, item: HTMLElement, clientY: number): HTMLElement | null {
  return directItems(container)
    .filter(candidate => candidate !== item)
    .find(candidate => {
      const rect = candidate.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    }) || null;
}

function clearDropMarker(container: HTMLElement) {
  directItems(container).forEach(item => item.classList.remove("cw-drop-before"));
}

export function mountVerticalSortable(container: HTMLElement, options: VerticalSortableOptions): () => void {
  let active: ActiveDrag | null = null;

  const finish = (commit: boolean) => {
    const drag = active;
    if (!drag) return;
    active = null;
    clearDropMarker(container);
    container.classList.remove("cw-dnd-active");
    if (container.hasPointerCapture?.(drag.pointerId)) container.releasePointerCapture(drag.pointerId);

    if (commit && drag.moved && drag.placeBefore !== drag.item) {
      if (drag.placeBefore) container.insertBefore(drag.item, drag.placeBefore);
      else container.appendChild(drag.item);
    }

    drag.item.classList.remove("is-dragging");
    drag.item.style.transform = drag.previousTransform;
    drag.item.style.zIndex = drag.previousZIndex;
    drag.item.style.willChange = drag.previousWillChange;

    const nextOrder = itemIds(container);
    if (commit && drag.moved && nextOrder.join("\u0000") !== drag.initialOrder.join("\u0000")) {
      void options.onDrop?.(nextOrder, drag.item.dataset.dndId || "");
    }
    options.onDragEnd?.();
  };

  const onPointerDown = (event: PointerEvent) => {
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>(options.handleSelector) : null;
    if (active || event.button !== 0 || isDisabled(handle)) return;
    const item = itemFromHandle(container, event.target, options.handleSelector);
    const id = item?.dataset.dndId || "";
    if (!item || !id) return;

    active = {
      item,
      pointerId: event.pointerId,
      startY: event.clientY,
      initialOrder: itemIds(container),
      moved: false,
      placeBefore: null,
      previousTransform: item.style.transform,
      previousZIndex: item.style.zIndex,
      previousWillChange: item.style.willChange,
    };
    item.classList.add("is-dragging");
    container.classList.add("cw-dnd-active");
    item.style.willChange = "transform";
    container.setPointerCapture?.(event.pointerId);
    options.onDragStart?.(id);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    const drag = active;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < 4) return;
    drag.moved = true;
    drag.item.style.transform = `translateY(${deltaY}px)`;
    const placeBefore = placeBeforeForPoint(container, drag.item, event.clientY);
    if (placeBefore !== drag.placeBefore) {
      clearDropMarker(container);
      placeBefore?.classList.add("cw-drop-before");
      drag.placeBefore = placeBefore;
    }
    event.preventDefault();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (active && event.pointerId === active.pointerId) finish(true);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (active && event.pointerId === active.pointerId) finish(false);
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>(options.handleSelector) : null;
    if (!handle || isDisabled(handle)) return;
    const item = itemFromHandle(container, handle, options.handleSelector);
    if (!item) return;
    const items = directItems(container);
    const index = items.indexOf(item);
    const targetIndex = index + (event.key === "ArrowUp" ? -1 : 1);
    if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return;
    const target = items[targetIndex];
    if (event.key === "ArrowUp") container.insertBefore(item, target);
    else container.insertBefore(item, target.nextSibling);
    event.preventDefault();
    void options.onDrop?.(itemIds(container), item.dataset.dndId || "");
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerCancel);
  container.addEventListener("keydown", onKeydown);

  return () => {
    finish(false);
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerUp);
    container.removeEventListener("pointercancel", onPointerCancel);
    container.removeEventListener("keydown", onKeydown);
  };
}
