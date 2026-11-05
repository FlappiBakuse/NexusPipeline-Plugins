export async function choose(control, value) {
  await control.locator('input[role=combobox]').click();
  await control.locator(`[role=option][data-id=${JSON.stringify(value)}]`).click();
}

export async function confirm(page, accepted = true) {
  const dialog = page.locator('nexus-confirm-dialog');
  await dialog.locator(`[data-action=${accepted ? 'confirm' : 'cancel'}]`).click();
  await dialog.waitFor({ state: 'detached' });
}
