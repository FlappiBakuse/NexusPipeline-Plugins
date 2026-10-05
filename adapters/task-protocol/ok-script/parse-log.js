function parseOkLog(text) {
  // Exact logging.Formatter + Logger prefix from the reviewed ok-script wheels.
  // Traceback continuation lines and quoted messages cannot open task scopes.
  const match = text.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} (DEBUG|INFO|WARNING|ERROR|CRITICAL) (\S+) ([A-Za-z_][A-Za-z_0-9]*):(.*)$/);
  return match ? { level: match[1], thread: match[2], owner: match[3], message: match[4] } : null;
}
