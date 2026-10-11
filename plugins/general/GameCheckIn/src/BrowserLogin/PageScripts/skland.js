() => {
  const visible = element => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  if (Array.from(document.querySelectorAll('iframe[src*="hypergryph.com"], [role="dialog"], .hg-sdk-base-vars')).some(visible)) return 'already-open';
  const entry = Array.from(document.querySelectorAll('.header-right .header-button')).find(visible);
  if (!entry) {
    if (Array.from(document.querySelectorAll('.header-right [class*="Avatar"]')).some(visible)) return 'already-authenticated';
    return 'waiting';
  }
  if (!/登录|登錄|log\s*in|sign\s*in/i.test(entry.textContent)) return 'already-authenticated';
  entry.click();
  return 'clicked';
}
