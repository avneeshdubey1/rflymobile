import { getCache, setCache, purgeUserCache } from '../src/storage/cache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm, value: string) => `hash_${value.length}`),
  randomUUID: jest.fn(() => 'cache-master-key'),
}));

jest.mock('crypto-js', () => {
  return {
    AES: {
      encrypt: jest.fn((data, key) => ({ toString: () => `enc_${data}` })),
      decrypt: jest.fn((data, key) => ({ toString: () => data.replace('enc_', '') })),
    },
    enc: { Utf8: 'utf8' }
  };
});

describe('Cache & Draft Behaviour (OMR-09)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test_master_key');
  });

  it('sets cache with encryption and user scope', async () => {
    await setCache('customerSummary', 'search_query', { foo: 'bar' }, 'user_123');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@cache_customerSummary_hash_28',
      expect.stringContaining('enc_')
    );
    expect((AsyncStorage.setItem as jest.Mock).mock.calls[0][0]).not.toContain('search_query');
  });

  it('retrieves cache and validates user isolation', async () => {
    const mockPayload = {
      data: { foo: 'bar' },
      timestamp: Date.now(),
      userId: 'user_123'
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(`enc_${JSON.stringify(mockPayload)}`);

    // Valid user read
    const valid = await getCache('customerSummary', 'search_query', 'user_123');
    expect(valid).not.toBeNull();
    expect(valid?.data.foo).toBe('bar');
    expect(valid?.isStale).toBe(false);

    // Isolated user read (should fail and return null)
    const isolated = await getCache('customerSummary', 'search_query', 'user_999');
    expect(isolated).toBeNull();
  });

  it('flags stale cache correctly based on TTL rules', async () => {
    const mockPayload = {
      data: { old: 'data' },
      timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      userId: 'user_123'
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(`enc_${JSON.stringify(mockPayload)}`);

    // customerSummary TTL is 24h, so 25h is stale
    const valid = await getCache('customerSummary', 'search_query', 'user_123');
    expect(valid).not.toBeNull();
    expect(valid?.isStale).toBe(true);
  });

  it('purges user cache entirely on logout', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
      '@cache_customerSummary_q1',
      '@cache_salesDrafts_d1',
      'other_key'
    ]);
    
    // Mock the payloads inside those keys
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => {
      if (key === '@cache_customerSummary_q1') return `enc_${JSON.stringify({ userId: 'user_123' })}`;
      if (key === '@cache_salesDrafts_d1') return `enc_${JSON.stringify({ userId: 'user_999' })}`; // Other user
      return null;
    });

    await purgeUserCache('user_123');
    
    // Should only remove user_123's items
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@cache_customerSummary_q1');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('@cache_salesDrafts_d1');
  });
});
