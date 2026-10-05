import { fail } from "../contract.mjs";
export function assertCapture(metrics) {
  if (metrics.screenshotCapture < 1) fail("LiveScreenshot renderer 未调用 executionPreview.capture");
}
