
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
    expect(isNotificationSupported()).toBe(true);
  });
});

describe("notifications — getNotificationPermission", () => {
  it("returns current permission", () => {
    mockPermission = "granted";
    expect(getNotificationPermission()).toBe("granted");
  });

  it("returns denied when permission is denied", () => {
    mockPermission = "denied";
    expect(getNotificationPermission()).toBe("denied");
  });

  it("returns default when permission is default", () => {
    mockPermission = "default";
    expect(getNotificationPermission()).toBe("default");
  });
});

describe("notifications — requestNotificationPermission", () => {
  it("returns existing permission if already granted", async () => {
    mockPermission = "granted";
    const result = await requestNotificationPermission();
    expect(result).toBe("granted");
  });

  it("returns existing permission if already denied", async () => {
    mockPermission = "denied";
    const result = await requestNotificationPermission();
    expect(result).toBe("denied");
  });

  it("requests permission when default and returns granted", async () => {
    mockPermission = "default";
    mockRequestResult = "granted";
    const result = await requestNotificationPermission();
    expect(result).toBe("granted");
  });

  it("requests permission when default and returns denied", async () => {
    mockPermission = "default";
    mockRequestResult = "denied";
    const result = await requestNotificationPermission();
    expect(result).toBe("denied");
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
    expect(result).not.toBe(null);
    expect(lastNotificationArgs?.title).toBe("Translation Complete");
    expect(lastNotificationArgs?.options.body).toBe("12 chapters translated");
  });

  it("uses default icon when none provided", () => {
    sendNotification({ title: "Test" });
    expect(lastNotificationArgs?.options.icon).toBe("/icon.svg");
  });

  it("uses custom icon when provided", () => {
    sendNotification({ title: "Test", icon: "/custom.png" });
    expect(lastNotificationArgs?.options.icon).toBe("/custom.png");
  });

  it("passes tag for notification deduplication", () => {
    sendNotification({ title: "Test", tag: "translation-job-123" });
    expect(lastNotificationArgs?.options.tag).toBe("translation-job-123");
  });

  it("returns null when permission not granted", () => {
    mockPermission = "denied";
    const result = sendNotification({ title: "Test" });
    expect(result).toBe(null);
  });

  it("returns null when permission is default (not yet requested)", () => {
    mockPermission = "default";
    const result = sendNotification({ title: "Test" });
    expect(result).toBe(null);
  });

  it("returns null when tab is visible (user sees in-app toast)", () => {
    mockVisibilityState = "visible";
    const result = sendNotification({ title: "Test" });
    expect(result).toBe(null);
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

    expect(notification).not.toBe(null);
    // Simulate clicking the notification
    if (notification && notification.onclick) {
      (notification.onclick as () => void).call(notification);
    }
    expect(clicked).toBe(true);
    expect(focused).toBe(true);

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
