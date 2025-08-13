import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../src/routes/api/freee/sync-selected/+server';

// Prismaのモック
const mockPrisma = {
  $transaction: vi.fn(),
  transaction: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
};

vi.mock('$lib/database', () => ({
  prisma: mockPrisma
}));

describe('/api/freee/sync-selected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body: any) => ({
    json: vi.fn().mockResolvedValue(body)
  } as any);

  const mockTransaction = {
    id: 'test-id',
    journalNumber: BigInt(123),
    journalLineNumber: 1,
    date: new Date('2024-01-01'),
    description: 'Test transaction',
    amount: 1000,
    account: 'Test Account',
    supplier: 'Test Supplier',
    memo: 'Test memo',
    freeDealId: BigInt(123),
    detailId: BigInt(456),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockDeal = {
    id: 123,
    issue_date: '2024-01-01',
    ref_number: 'REF-001',
    memo: 'Test memo',
    partner_name: 'Test Partner',
    details: [{
      id: 456,
      amount: 1000,
      account_item_name: 'Test Account',
      description: 'Test description'
    }]
  };

  it('should return error when no deals provided', async () => {
    const request = createMockRequest({ deals: [] });
    
    const response = await POST({ request } as any);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('同期するデータが選択されていません');
  });

  it('should create new transaction when no existing transaction found', async () => {
    const mockTx = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(mockTransaction),
        update: vi.fn(),
        delete: vi.fn()
      }
    };

    const mockPrismaTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    mockPrisma.$transaction.mockImplementation(mockPrismaTransaction);

    const request = createMockRequest({
      deals: [mockDeal],
      companyId: 'test-company'
    });

    const response = await POST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.created).toBe(1);
    expect(data.stats.updated).toBe(0);
    expect(data.stats.skipped).toBe(0);
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.stringMatching(/^freee_123_\d+$/),
        journalNumber: BigInt(123),
        freeDealId: BigInt(123),
        amount: 1000,
        account: 'Test Account',
        supplier: 'Test Partner'
      })
    });
  });

  it('should update existing transaction when changes detected', async () => {
    const existingTransaction = {
      ...mockTransaction,
      amount: 2000 // 異なる金額
    };

    const mockTx = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([existingTransaction]),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(mockTransaction),
        delete: vi.fn()
      }
    };

    const mockPrismaTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    mockPrisma.$transaction.mockImplementation(mockPrismaTransaction);

    const request = createMockRequest({
      deals: [mockDeal],
      companyId: 'test-company'
    });

    const response = await POST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.created).toBe(0);
    expect(data.stats.updated).toBe(1);
    expect(data.stats.skipped).toBe(0);
    expect(mockTx.transaction.update).toHaveBeenCalledWith({
      where: { id: 'test-id' },
      data: expect.objectContaining({
        amount: 1000,
        updatedAt: expect.any(Date)
      })
    });
  });

  it('should skip transaction when no changes detected', async () => {
    const existingTransaction = mockTransaction;

    const mockTx = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([existingTransaction]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    };

    const mockPrismaTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    mockPrisma.$transaction.mockImplementation(mockPrismaTransaction);

    const request = createMockRequest({
      deals: [mockDeal],
      companyId: 'test-company'
    });

    const response = await POST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.created).toBe(0);
    expect(data.stats.updated).toBe(0);
    expect(data.stats.skipped).toBe(1);
    expect(mockTx.transaction.create).not.toHaveBeenCalled();
    expect(mockTx.transaction.update).not.toHaveBeenCalled();
  });

  it('should delete transactions not present in freee data', async () => {
    const existingTransaction = {
      ...mockTransaction,
      freeDealId: BigInt(999) // freeeにない取引
    };

    const mockTx = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([existingTransaction]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue(existingTransaction)
      }
    };

    const mockPrismaTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    mockPrisma.$transaction.mockImplementation(mockPrismaTransaction);

    const request = createMockRequest({
      deals: [mockDeal], // ID: 123のみ
      companyId: 'test-company'
    });

    const response = await POST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.deleted).toBe(1);
    expect(mockTx.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'test-id' }
    });
  });

  it('should handle multiple deals correctly', async () => {
    const deal2 = {
      ...mockDeal,
      id: 124,
      details: [{
        id: 457,
        amount: 2000,
        account_item_name: 'Another Account'
      }]
    };

    const mockTx = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(mockTransaction),
        update: vi.fn(),
        delete: vi.fn()
      }
    };

    const mockPrismaTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    mockPrisma.$transaction.mockImplementation(mockPrismaTransaction);

    const request = createMockRequest({
      deals: [mockDeal, deal2],
      companyId: 'test-company'
    });

    const response = await POST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.created).toBe(2);
    expect(data.stats.selected).toBe(2);
    expect(mockTx.transaction.create).toHaveBeenCalledTimes(2);
  });

  it('should handle errors gracefully', async () => {
    const mockTx = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockRejectedValue(new Error('Database error')),
        update: vi.fn(),
        delete: vi.fn()
      }
    };

    const mockPrismaTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    mockPrisma.$transaction.mockImplementation(mockPrismaTransaction);

    const request = createMockRequest({
      deals: [mockDeal],
      companyId: 'test-company'
    });

    const response = await POST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.errors).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].freeDealId).toBe('123');
    expect(data.errors[0].error).toBe('Database error');
  });

  it('should handle transaction-level errors', async () => {
    const mockPrismaTransaction = vi.fn().mockRejectedValue(new Error('Transaction failed'));

    mockPrisma.$transaction.mockImplementation(mockPrismaTransaction);

    const request = createMockRequest({
      deals: [mockDeal],
      companyId: 'test-company'
    });

    const response = await POST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('同期処理でエラーが発生しました');
  });

  it('should handle deal without details', async () => {
    const dealWithoutDetails = {
      id: 123,
      issue_date: '2024-01-01',
      amount: 1500,
      partner_name: 'Test Partner',
      memo: 'Test memo'
    };

    const mockTx = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(mockTransaction),
        update: vi.fn(),
        delete: vi.fn()
      }
    };

    const mockPrismaTransaction = vi.fn().mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    mockPrisma.$transaction.mockImplementation(mockPrismaTransaction);

    const request = createMockRequest({
      deals: [dealWithoutDetails],
      companyId: 'test-company'
    });

    const response = await POST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.created).toBe(1);
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 1500,
        account: '不明',
        detailId: BigInt(123) // dealIdと同じ値
      })
    });
  });
});