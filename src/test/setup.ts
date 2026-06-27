import '@testing-library/jest-dom';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperties(Element.prototype, {
  hasPointerCapture: {
    writable: true,
    configurable: true,
    value: () => false,
  },
  setPointerCapture: {
    writable: true,
    configurable: true,
    value: () => {},
  },
  releasePointerCapture: {
    writable: true,
    configurable: true,
    value: () => {},
  },
  scrollIntoView: {
    writable: true,
    configurable: true,
    value: () => {},
  },
});
