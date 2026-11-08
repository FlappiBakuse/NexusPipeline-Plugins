export function resizeCarousel(stage: HTMLElement, expanded: boolean, signal: AbortSignal): void {
  const viewport = stage.querySelector<HTMLElement>('.activity-viewport')!;
  const surfaces = [viewport, ...stage.querySelectorAll<HTMLElement>('.activity-slide')];
  const before = viewport.getBoundingClientRect().height;
  for (const surface of surfaces)
    for (const animation of surface.getAnimations()) animation.cancel();
  stage.classList.toggle('activity-expanded', expanded);
  const after = viewport.getBoundingClientRect().height;
  const duration = getComputedStyle(stage).getPropertyValue('--nx-motion-duration-normal');
  if (!before || before === after || signal.aborted || matchMedia('(prefers-reduced-motion: reduce)').matches ||
      duration && parseFloat(duration) === 0) return;
  const animations = surfaces.map(surface => surface.animate([{ height: before + 'px' }, { height: after + 'px' }],
    { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }));
  const cancel = () => animations.forEach(animation => animation.cancel());
  signal.addEventListener('abort', cancel, { once: true });
  void Promise.all(animations.map(animation => animation.finished)).catch(() => {})
    .finally(() => signal.removeEventListener('abort', cancel));
}
