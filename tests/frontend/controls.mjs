export async function choose(control, value) {
  await control.locator('input[role=combobox]').click();
  await control.locator(`[role=option][data-id=${JSON.stringify(value)}]`).click();
}

export async function confirm(page, accepted = true) {
  const dialog = page.locator('nexus-confirm-dialog');
  await dialog.locator(`[data-action=${accepted ? 'confirm' : 'cancel'}]`).click();
  await dialog.waitFor({ state: 'detached' });
}

export async function fieldHelp(page, control, expected) {
  const inputs = control.locator('input,textarea');
  await (await inputs.count() ? inputs.first() : control).focus();
  const bubble = page.locator('nexus-tooltip .panel:visible').filter({ hasText: expected });
  try { await bubble.waitFor({ state: 'visible' }); }
  catch (error) {
    const state = await control.evaluate(anchor => ({ rect: anchor.getBoundingClientRect().toJSON(),
      tooltips: [...document.querySelectorAll('nexus-tooltip')].filter(item => item.anchor === anchor)
        .map(item => ({ content: item.content, open: item.open, connected: item.isConnected, hidden: item.hidden,
          hovered: anchor.matches(':hover'), inert: !!anchor.closest('[inert]') })) }));
    throw Error('Plugin field help unavailable: ' + JSON.stringify(state), { cause: error });
  }
  const described = await control.evaluate(element => {
    const input = element.shadowRoot?.querySelector('input,textarea') || element.shadowRoot?.querySelector('button') || element;
    return input.ariaDescribedByElements?.map(node => node.textContent).join(' ') || '';
  });
  if (!described.includes(expected)) throw Error('Plugin input is missing its help description: ' + expected);
  await page.keyboard.press('Escape');
  await bubble.waitFor({ state: 'hidden' });
}
