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
  const help = page.locator('nexus-tooltip').filter({ visible: true });
  const anchor = await control.elementHandle();
  let trigger;
  for (const tooltip of await help.all()) {
    if (await tooltip.evaluate((node, anchor) => node.anchor === anchor, anchor)) {
      trigger = tooltip.locator('button.question');
      break;
    }
  }
  await anchor.dispose();
  if (!trigger) throw Error('Missing field question mark: ' + expected);
  await trigger.click();
  const bubble = page.locator('nexus-tooltip .panel:visible').filter({ hasText: expected });
  await bubble.waitFor();
  if (await trigger.getAttribute('aria-expanded') !== 'true') throw Error('Field question mark did not expand');
  const described = await control.evaluate(element => {
    const input = element.shadowRoot?.querySelector('input,textarea') || element.shadowRoot?.querySelector('button') || element;
    return input.ariaDescribedByElements?.map(node => node.textContent).join(' ') || '';
  });
  if (!described.includes(expected)) throw Error('Plugin input is missing its help description: ' + expected);
  await page.keyboard.press('Escape');
  await bubble.waitFor({ state: 'hidden' });
}
