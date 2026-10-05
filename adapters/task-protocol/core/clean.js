function clean(text) { return String(text).replace(/\x1b\[[0-9;]*m/g, '').trim(); }
