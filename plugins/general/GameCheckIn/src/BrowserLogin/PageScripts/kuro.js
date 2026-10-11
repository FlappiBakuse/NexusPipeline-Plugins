() => {
  const visible = element => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  if (Array.from(document.querySelectorAll('[role="dialog"], iframe[src*="login"]')).some(visible)) return 'already-open';
  const avatar = document.querySelector('.right-section button.personal-center-btn');
  if (!visible(avatar)) return 'waiting';
  if (avatar.textContent.trim() && !/登录|登錄|log\s*in|sign\s*in/i.test(avatar.textContent)) return 'already-authenticated';
  avatar.click();
  return 'clicked';
}
