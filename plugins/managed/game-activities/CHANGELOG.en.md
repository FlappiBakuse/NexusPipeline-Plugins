# Changelog

## 0.5.0

- Add eleven SRA feeds for eight games, complete game ordering, and Blue Archive / Neverness to Everness progression settings.
- Connect Host Documents, Http and frontend transport for persistent caching, CAS settings, scheduled refresh and rate-limited manual refresh.
- Preserve unknown source time zones and display verified instants in the computer time zone; image failures retain text and last good feed data.
- Bound cover origins, response sizes, memory caching and activation cleanup.
- Interpret offset-free times from the 11 known sources as UTC+8, preferring explicit offsets; unknown sources remain unknown.
- Fetch covers outside the short cache lock, with four concurrent misses and generation-bound publication.
