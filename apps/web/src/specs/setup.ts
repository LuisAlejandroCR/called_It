// setup.ts (not *.test.*: the root `node --test` must not pick up vitest files): test environment shims (jest-dom matchers, scrollTo and matchMedia stubs for jsdom).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });
