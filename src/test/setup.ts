import { vi } from 'vitest';

// グローバルなsetupとcleanupの設定
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
});

// BigIntのJSONサポート
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

// 環境変数のモック
vi.mock('$env/static/private', () => ({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db'
}));

// Prismaのモック（個別テストで上書き可能）
vi.mock('$lib/database', () => ({
  prisma: {
    $transaction: vi.fn(),
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}));