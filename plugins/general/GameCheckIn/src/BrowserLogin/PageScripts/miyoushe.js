() => {
  const visible = element => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  if (Array.from(document.querySelectorAll('#mihoyo-login-platform-iframe, iframe[src*="user.miyoushe.com"], iframe[src*="user.mihoyo.com"], .mhy-login-dialog, [role="dialog"]')).some(visible)) return 'already-open';
  const avatar = document.querySelector('a.header__avatar');
  if (!visible(avatar)) return 'waiting';
  const identity = new URL(avatar.href, location.href).searchParams.get('id');
  if (identity && /^[0-9]+$/.test(identity)) return 'already-authenticated';
  avatar.click();
  return 'clicked';
}
