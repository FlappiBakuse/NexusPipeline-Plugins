export function createImageQueue(signal: AbortSignal, maximum = 4) {
  const jobs = new Map<Element, () => Promise<void>>();
  const queue: Element[] = [];
  let active = 0;
  let closed = false;
  const pump = () => {
    while (!closed && !signal.aborted && active < maximum && queue.length) {
      const element = queue.shift()!;
      const job = jobs.get(element);
      if (!job) continue;
      jobs.delete(element); active++;
      void job().catch(() => {}).finally(() => { active--; pump(); });
    }
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting && jobs.has(entry.target)) {
      observer.unobserve(entry.target); queue.push(entry.target);
    }
    pump();
  });
  const dispose = () => { closed = true; observer.disconnect(); jobs.clear(); queue.length = 0; };
  signal.addEventListener('abort', dispose, { once: true });
  return {
    observe(element: Element, load: () => Promise<void>) {
      if (closed || signal.aborted || jobs.has(element)) return;
      jobs.set(element, load); observer.observe(element);
    },
    unobserve(element: Element) { observer.unobserve(element); jobs.delete(element); },
    dispose,
  };
}
