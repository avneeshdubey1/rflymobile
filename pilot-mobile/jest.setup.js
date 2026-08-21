// Mock crypto.randomUUID for environments where it isn't available
if (typeof crypto === "undefined") {
  global.crypto = {
    randomUUID: () => "12345678-1234-4234-8234-123456789012",
  };
} else if (!crypto.randomUUID) {
  crypto.randomUUID = () => "12345678-1234-4234-8234-123456789012";
}

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => "12345678-1234-4234-8234-123456789012",
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32)),
}));

jest.mock("expo-sqlite", () => ({
  deleteDatabaseAsync: jest.fn().mockResolvedValue(undefined),
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn(),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    withTransactionAsync: jest.fn().mockImplementation((cb) => cb()),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn(),
    closeAsync: jest.fn().mockResolvedValue(undefined),
    prepareAsync: jest.fn().mockResolvedValue({
      executeAsync: jest.fn(),
      finalizeAsync: jest.fn(),
    }),
  }),
}));

jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///test-dir/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

// Provide a mock URL for testing so that api.ts doesn't throw during initialization
process.env.EXPO_PUBLIC_API_URL = "http://localhost:3000";
