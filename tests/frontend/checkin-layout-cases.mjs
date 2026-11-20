export async function checkinLayoutCases({ page, test }) {
  await test('checkin empty card shares Host dimensions and typography', async () => {
    await page.evaluate(async () => {
      const state = { revision: 1, timeZoneId: 'UTC', platforms: [], notificationTasks: [], tasks: [] };
      await window.testMount('game-checkin', { readState: async () => state }, 'route');
    });
    await page.getByText('还没有签到任务', { exact: true }).waitFor();
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.locator('.checkin-empty').evaluate(empty => {
        const reference = document.createElement('nexus-empty-state');
        reference.title = empty.title; reference.description = empty.description;
        reference.style.width = empty.getBoundingClientRect().width + 'px';
        document.body.append(reference);
        const measure = element => {
          const title = getComputedStyle(element.shadowRoot.querySelector('h3'));
          const description = getComputedStyle(element.shadowRoot.querySelector('p'));
          return { height: element.getBoundingClientRect().height, titleSize: title.fontSize, titleWeight: title.fontWeight,
            descriptionSize: description.fontSize, descriptionWeight: description.fontWeight };
        };
        const result = { actual: measure(empty), reference: measure(reference) };
        reference.remove();
        return result;
      });
      if (JSON.stringify(dimensions.actual) !== JSON.stringify(dimensions.reference) || dimensions.actual.height !== 147 ||
        dimensions.actual.titleSize !== '15px' || dimensions.actual.titleWeight !== '700' ||
        dimensions.actual.descriptionSize !== '13px' || dimensions.actual.descriptionWeight !== '400')
        throw Error('Check-in empty card differs from Host empty states: ' + JSON.stringify({ width, ...dimensions }));
    }
  });
  await test('checkin unchanged page waits for events and resumes current state after hiding', async () => {
    await page.evaluate(async () => {
      window.stateReads = 0; window.stateSubscriptions = 0;
      window.eventState = { revision: 1, timeZoneId: 'UTC', platforms: [], notificationTasks: [], tasks: [] };
      await window.testMount('game-checkin', {
        readState: async () => { window.stateReads++; return window.eventState; },
        subscribe: listener => {
          window.stateSubscriptions++; window.stateListener = listener;
          return () => { window.stateSubscriptions--; window.stateListener = undefined; };
        }
      }, 'route');
    });
    await page.getByText('还没有签到任务', { exact: true }).waitFor();
    const reads = await page.evaluate(() => window.stateReads);
    await page.waitForTimeout(5500);
    if (await page.evaluate(() => window.stateReads) !== reads) throw Error('Unchanged page issued a periodic state read');
    await page.evaluate(() => {
      window.eventState = { ...window.eventState, revision: 2, tasks: [{ id: 'event-task', name: 'Event task', remark: '', enabled: false,
        games: {}, schedules: [], notification: { enabled: false, notificationTaskIds: [] }, isRunning: false }] };
      window.stateListener();
    });
    await page.getByText('Event task', { exact: true }).waitFor();
    await page.evaluate(() => window.fixture.hide());
    if (await page.evaluate(() => window.stateSubscriptions) !== 0) throw Error('Hidden page retained a subscription');
    await page.evaluate(() => {
      window.eventState = { ...window.eventState, revision: 3, tasks: [{ ...window.eventState.tasks[0], name: 'Visible return' }] };
      window.fixture.show();
    });
    await page.getByText('Visible return', { exact: true }).waitFor();
    await page.evaluate(() => window.fixture.dispose());
    if (await page.evaluate(() => window.stateSubscriptions) !== 0) throw Error('Disposed page retained a subscription');
  });
  await test('checkin compact centered task rows', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(async () => {
      const state = { revision: 1, timeZoneId: 'UTC', platforms: [], notificationTasks: [], tasks: [
        ...['first', 'second'].map(id => ({ id, name: 'Compact task', remark: '', enabled: false, games: {}, schedules: [],
          notification: { enabled: false, notificationTaskIds: [] }, isRunning: false }))
      ] };
      await window.testMount('game-checkin', { readState: async () => state }, 'route');
    });
    await page.locator('.checkin-task').first().waitFor();
    const measure = await page.locator('.checkin-task').first().evaluate(row => {
      const box = row.getBoundingClientRect(), center = box.top + box.height / 2;
      return { height: box.height, offsets: [...row.querySelector('.checkin-task-head').children]
        .map(e => { const b = e.getBoundingClientRect(); return Math.abs(b.top + b.height / 2 - center); }) };
    });
    if (measure.height > 90 || measure.offsets.some(offset => offset > 1))
      throw Error('Task row is oversized or its contents are not vertically centered: ' + JSON.stringify(measure));
    const cards = await page.locator('.checkin-task').evaluateAll(rows => rows.map(row => ({ top: row.getBoundingClientRect().top, bottom: row.getBoundingClientRect().bottom, border: getComputedStyle(row).borderBottomWidth, radius: getComputedStyle(row).borderRadius })));
    if (cards.length !== 2 || cards[1].top <= cards[0].bottom || cards.some(card => parseFloat(card.border) <= 0 || parseFloat(card.radius) <= 0)) throw Error('Tasks must have separate rounded borders and spacing');
    if (await page.locator('.checkin-eyebrow').count()) throw Error('Page eyebrow remains');
    for (const width of [1280, 640, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.locator('.checkin-task').first().evaluate(row => {
        const name = row.querySelector('h2');
        const actions = [...row.querySelectorAll('.checkin-task-actions > nexus-icon-button')];
        const boxes = actions.map(element => element.getBoundingClientRect());
        return {
          fitsCard: row.scrollWidth <= row.clientWidth,
          titleFits: getComputedStyle(name).overflow === 'visible' && name.getBoundingClientRect().right <= boxes[0]?.left,
          squareActions: boxes.length === 3 && boxes.every(box => box.width === box.height && box.top === boxes[0].top),
          labeledIcons: actions.every(element => {
            const button = element.shadowRoot.querySelector('button');
            return Boolean(button.getAttribute('aria-label') && !button.textContent.trim() && button.querySelector('svg path'));
          })
        };
      });
      if (Object.values(layout).some(value => !value)) throw Error(JSON.stringify({ width, layout }));
    }
    await page.evaluate(() => window.fixture.dispose());
  });
}
