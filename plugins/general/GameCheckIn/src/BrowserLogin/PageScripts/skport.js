() => {
  const visible = element => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  if (Array.from(document.querySelectorAll('iframe[src*="gryphline.com"], [role="dialog"]')).some(visible)
    || Array.from(document.querySelectorAll('.hg-sdk-base-vars')).some(element => visible(element) && getComputedStyle(element).position === 'absolute')) return 'already-open';
  const avatar = document.querySelector('header .header-right [class*="Header__AvatarWrapper"]');
  if (!visible(avatar)) return 'waiting';
  const items = Array.from(document.querySelectorAll('.tooltip-modal [class*="HAvatar__PopoverWrapper"] [class*="HAvatar__ItemBlock"]')).filter(visible);
  const label = element => element.textContent.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const logoutLabels = new Set(['logout', 'log out', 'sign out', '退出登录', '退出登錄', '退出', '登出', '注销', '註銷', 'ログアウト', '로그아웃']);
  if (items.some(element => logoutLabels.has(label(element)))) return 'already-authenticated';
  const image = avatar.querySelector('img');
  if (image && image.getAttribute('src')) return 'already-authenticated';
  const loginLabels = new Set(['login', 'log in', 'sign in', '登录', '登錄', '登入', 'ログイン', '로그인']);
  const logins = items.filter(element => loginLabels.has(label(element)));
  if (logins.length === 1 && !globalThis.__nxpSkportLoginClicked) {
    globalThis.__nxpSkportLoginClicked = true;
    logins[0].click();
    return 'clicked';
  }
  if (items.length > 0) return 'waiting';
  if (!globalThis.__nxpSkportAvatarClicked) { globalThis.__nxpSkportAvatarClicked = true; avatar.click(); }
  return 'waiting';
}
