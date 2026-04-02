import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ─── Browser API Mocks ────────────────────────────────────────────

let mockPermission = "default";
let mockRequestResult = "granted";
let mockVisibilityState = "hidden";
let lastNotificationArgs: { title: string; options: Record<string, unknown> } | null = null;

class MockNotification {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  onclick: (() => void) | null = null;

  constructor(title: string, options: Record<string, unknown> = {}) {
    this.title = title;
    this.body = options.body as string | undefined;
    this.icon = options.icon as string | undefined;
    this.tag = options.tag as string | undefined;
    lastNotificationArgs = { title, options };
  }

  close() {
    // no-op
  }

  static get permission(): string {
    return mockPermission;
  }

  static requestPermission(): Promise<string> {
    return Promise.resolve(mockRequestResult);
  }
}

function installBrowserEnv() {
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).Notification = MockNotification;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    get() {
      return {
        get visibilityState() {
          return mockVisibilityState;
        },
      };
    },
  });
}

// Install browser env BEFORE importing module so the top-level typeof checks pass.
// Individual tests can override mockPermission/mockVisibilityState as needed.
installBrowserEnv();

// Now import — the module will see `window` and `Notification` in scope
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendNotification,
} from "./notifications.js";

// ─── Tests ────────────────────────────────────────────────────────

describe("notifications — isNotificationSupported", () => {
  it("returns true when Notification exists on window", () => {
    assert.equal(isNotificationSupported(), true);
  });
});

describe("notifications — getNotificationPermission", () => {
  it("returns current permission", () => {
    mockPermission = "granted";
    assert.equal(getNotificationPermission(), "granted");
  });

  it("returns denied when permission is denied", () => {
    mockPermission = "denied";
    assert.equal(getNotificationPermission(), "denied");
  });

  it("returns default when permission is default", () => {
    mockPermission = "default";
    assert.equal(getNotificationPermission(), "default");
  });
});

describe("notifications — requestNotificationPermission", () => {
  it("returns existing permission if already granted", async () => {
    mockPermission = "granted";
    const result = await requestNotificationPermission();
    assert.equal(result, "granted");
  });

  it("returns existing permission if already denied", async () => {
    mockPermission = "denied";
    const result = await requestNotificationPermission();
    assert.equal(result, "denied");
  });

  it("requests permission when default and returns granted", async () => {
    mockPermission = "default";
    mockRequestResult = "granted";
    const result = await requestNotificationPermission();
    assert.equal(result, "granted");
  });

  it("requests permission when default and returns denied", async () => {
    mockPermission = "default";
    mockRequestResult = "denied";
    const result = await requestNotificationPermission();
    assert.equal(result, "denied");
  });
});

describe("notifications — sendNotification", () => {
  beforeEach(() => {
    mockPermission = "granted";
    mockVisibilityState = "hidden";
    lastNotificationArgs = null;
  });

  it("creates notification with title and body", () => {
    const result = sendNotification({
      title: "Translation Complete",
      body: "12 chapters translated",
    });
    assert.notEqual(result, null);
    assert.equal(lastNotificationArgs?.title, "Translation Complete");
    assert.equal(lastNotificationArgs?.options.body, "12 chapters translated");
  });

  it("uses default icon when none provided", () => {
    sendNotification({ title: "Test" });
    assert.equal(lastNotificationArgs?.options.icon, "/icon.svg");
  });

  it("uses custom icon when provided", () => {
    sendNotification({ title: "Test", icon: "/custom.png" });
    assert.equal(lastNotificationArgs?.options.icon, "/custom.png");
  });

  it("passes tag for notification deduplication", () => {
    sendNotification({ title: "Test", tag: "translation-job-123" });
    assert.equal(lastNotificationArgs?.options.tag, "translation-job-123");
  });

  it("returns null when permission not granted", () => {
    mockPermission = "denied";
    const result = sendNotification({ title: "Test" });
    assert.equal(result, null);
  });

  it("returns null when permission is default (not yet requested)", () => {
    mockPermission = "default";
    const result = sendNotification({ title: "Test" });
    assert.equal(result, null);
  });

  it("returns null when tab is visible (user sees in-app toast)", () => {
    mockVisibilityState = "visible";
    const result = sendNotification({ title: "Test" });
    assert.equal(result, null);
  });

  it("fires onClick handler and focuses window on click", () => {
    let clicked = false;
    let focused = false;

    // Override window.focus
    const origFocus = (globalThis as Record<string, unknown>).focus;
    (globalThis as Record<string, unknown>).focus = () => { focused = true; };

    const notification = sendNotification({
      title: "Test",
      onClick: () => { clicked = true; },
    });

    assert.notEqual(notification, null);
    // Simulate clicking the notification
    if (notification && notification.onclick) {
      (notification.onclick as () => void).call(notification);
    }
    assert.equal(clicked, true);
    assert.equal(focused, true);

    (globalThis as Record<string, unknown>).focus = origFocus;
  });
});

// Cleanup
afterEach(() => {
  mockPermission = "default";
  mockRequestResult = "granted";
  mockVisibilityState = "hidden";
  lastNotificationArgs = null;
});
