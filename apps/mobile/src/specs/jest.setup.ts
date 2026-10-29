// jest.setup.ts: test shims. Icons render nothing (the vector-icon font needs the native asset registry).
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
