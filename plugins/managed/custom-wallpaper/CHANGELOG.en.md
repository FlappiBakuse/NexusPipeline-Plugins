# Changelog

## 0.5.0

- Save wallpaper settings immediately. Restore confirmed values on failure and inspect unknown results without replay.

- Synchronize visible wallpaper and settings from subscriptions without unchanged-state polling.

- Add the card description and align category pinning, heading toggles and collapse animation.

- Use public collapsible cards and switch collections under the host settings expansion owner.

- Save wallpaper settings, original images and references through the SDK document transaction with deduplication and capacity limits.
- Connect authenticated uploads and image reads to the existing settings and appearance surfaces.
- Identify startup rotation through the Host native desktop session; browser connections do not create a desktop session.
