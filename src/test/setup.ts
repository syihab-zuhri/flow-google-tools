import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverMock;
}

// ReactFlow layout helper for JSDOM
if (!window.DOMRect) {
  // @ts-expect-error Mock minimal DOMRect
  window.DOMRect = {
    fromRect: () => ({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  };
}

// Mock Tauri Internals & Event listener for test environments
const win = window as unknown as Record<string, unknown>;
if (!win.__TAURI_INTERNALS__) {
  win.__TAURI_INTERNALS__ = {
    transformCallback: () => 1,
    invoke: () => Promise.resolve(),
  };
}

if (!win.__TAURI_EVENT_PLUGIN_INTERNALS__) {
  win.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => {},
  };
}
