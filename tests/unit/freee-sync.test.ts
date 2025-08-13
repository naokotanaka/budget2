import { describe, it, expect, vi } from 'vitest';
import {
  bigIntToString,
  safeBigInt,
  normalizeString,
  normalizeAmount,
  hasTransactionChanged,
  createTransactionDataFromDeal,
  isDebugEnabled
} from '../../src/lib/utils/freee-sync';
import type { Transaction } from '@prisma/client';
import type { FreeDeal } from '../../src/lib/utils/freee-sync';

describe('freee-sync utilities', () => {
  describe('bigIntToString', () => {
    it('should convert BigInt to string', () => {
      expect(bigIntToString(BigInt(123))).toBe('123');
    });

    it('should handle arrays with BigInt values', () => {
      const input = [BigInt(123), 'hello', BigInt(456)];
      const expected = ['123', 'hello', '456'];
      expect(bigIntToString(input)).toEqual(expected);
    });

    it('should handle objects with BigInt properties', () => {
      const input = {
        id: BigInt(123),
        name: 'test',
        nested: {
          value: BigInt(456)
        }
      };
      const expected = {
        id: '123',
        name: 'test',
        nested: {
          value: '456'
        }
      };
      expect(bigIntToString(input)).toEqual(expected);
    });

    it('should handle non-BigInt values unchanged', () => {
      expect(bigIntToString('hello')).toBe('hello');
      expect(bigIntToString(123)).toBe(123);
      expect(bigIntToString(null)).toBe(null);
      expect(bigIntToString(undefined)).toBe(undefined);
    });
  });

  describe('safeBigInt', () => {
    it('should convert string to BigInt', () => {
      expect(safeBigInt('123')).toBe(BigInt(123));
    });

    it('should convert number to BigInt', () => {
      expect(safeBigInt(123)).toBe(BigInt(123));
    });

    it('should return BigInt unchanged', () => {
      const bigIntValue = BigInt(123);
      expect(safeBigInt(bigIntValue)).toBe(bigIntValue);
    });

    it('should throw error for invalid input', () => {
      expect(() => safeBigInt(null)).toThrow('Cannot convert object to BigInt: null');
      expect(() => safeBigInt(undefined)).toThrow('Cannot convert undefined to BigInt: undefined');
      expect(() => safeBigInt({})).toThrow('Cannot convert object to BigInt: [object Object]');
    });
  });

  describe('normalizeString', () => {
    it('should trim whitespace', () => {
      expect(normalizeString('  hello  ')).toBe('hello');
    });

    it('should convert null/undefined to empty string', () => {
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
    });

    it('should convert numbers to string', () => {
      expect(normalizeString(123)).toBe('123');
    });

    it('should handle empty string', () => {
      expect(normalizeString('')).toBe('');
      expect(normalizeString('   ')).toBe('');
    });
  });

  describe('normalizeAmount', () => {
    it('should convert string to number', () => {
      expect(normalizeAmount('123')).toBe(123);
      expect(normalizeAmount('123.45')).toBe(123);
    });

    it('should convert BigInt to number', () => {
      expect(normalizeAmount(BigInt(123))).toBe(123);
    });

    it('should handle null/undefined as zero', () => {
      expect(normalizeAmount(null)).toBe(0);
      expect(normalizeAmount(undefined)).toBe(0);
    });

    it('should handle invalid strings as zero', () => {
      expect(normalizeAmount('invalid')).toBe(0);
      expect(normalizeAmount('')).toBe(0);
    });

    it('should handle numbers directly', () => {
      expect(normalizeAmount(123.45)).toBe(123.45);
    });
  });

  describe('hasTransactionChanged', () => {
    const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
      id: 'test-id',
      journalNumber: BigInt(1),
      journalLineNumber: 1,
      date: new Date('2024-01-01'),
      description: 'Test description',
      amount: 1000,
      account: 'Test Account',
      supplier: 'Test Supplier',
      memo: 'Test memo',
      freeDealId: BigInt(123),
      detailId: BigInt(456),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    });

    const createMockTransactionData = (overrides: any = {}) => ({
      journalNumber: BigInt(1),
      journalLineNumber: 1,
      date: new Date('2024-01-01'),
      description: 'Test description',
      amount: 1000,
      account: 'Test Account',
      supplier: 'Test Supplier',
      memo: 'Test memo',
      freeDealId: BigInt(123),
      detailId: BigInt(456),
      ...overrides
    });

    it('should return false when no changes', () => {
      const existing = createMockTransaction();
      const newData = createMockTransactionData();
      
      expect(hasTransactionChanged(existing, newData)).toBe(false);
    });

    it('should detect date changes', () => {
      const existing = createMockTransaction({ date: new Date('2024-01-01') });
      const newData = createMockTransactionData({ date: new Date('2024-01-02') });
      
      expect(hasTransactionChanged(existing, newData)).toBe(true);
    });

    it('should detect amount changes', () => {
      const existing = createMockTransaction({ amount: 1000 });
      const newData = createMockTransactionData({ amount: 2000 });
      
      expect(hasTransactionChanged(existing, newData)).toBe(true);
    });

    it('should detect description changes', () => {
      const existing = createMockTransaction({ description: 'Old description' });
      const newData = createMockTransactionData({ description: 'New description' });
      
      expect(hasTransactionChanged(existing, newData)).toBe(true);
    });

    it('should detect account changes', () => {
      const existing = createMockTransaction({ account: 'Old Account' });
      const newData = createMockTransactionData({ account: 'New Account' });
      
      expect(hasTransactionChanged(existing, newData)).toBe(true);
    });

    it('should detect supplier changes', () => {
      const existing = createMockTransaction({ supplier: 'Old Supplier' });
      const newData = createMockTransactionData({ supplier: 'New Supplier' });
      
      expect(hasTransactionChanged(existing, newData)).toBe(true);
    });

    it('should detect memo changes', () => {
      const existing = createMockTransaction({ memo: 'Old memo' });
      const newData = createMockTransactionData({ memo: 'New memo' });
      
      expect(hasTransactionChanged(existing, newData)).toBe(true);
    });

    it('should handle whitespace normalization', () => {
      const existing = createMockTransaction({ description: ' Test ' });
      const newData = createMockTransactionData({ description: 'Test' });
      
      expect(hasTransactionChanged(existing, newData)).toBe(false);
    });

    it('should handle null/undefined values', () => {
      const existing = createMockTransaction({ supplier: null as any });
      const newData = createMockTransactionData({ supplier: '' });
      
      expect(hasTransactionChanged(existing, newData)).toBe(false);
    });
  });

  describe('createTransactionDataFromDeal', () => {
    it('should create transaction data from deal with details', () => {
      const deal: FreeDeal = {
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

      const result = createTransactionDataFromDeal(deal);

      expect(result).toEqual({
        journalNumber: BigInt(123),
        journalLineNumber: 1,
        date: new Date('2024-01-01'),
        description: 'REF-001',
        amount: 1000,
        account: 'Test Account',
        supplier: 'Test Partner',
        memo: 'Test memo',
        freeDealId: BigInt(123),
        detailId: BigInt(456)
      });
    });

    it('should handle deal without details', () => {
      const deal: FreeDeal = {
        id: 123,
        issue_date: '2024-01-01',
        amount: 2000,
        partner_name: 'Test Partner',
        memo: 'Test memo'
      };

      const result = createTransactionDataFromDeal(deal);

      expect(result.amount).toBe(2000);
      expect(result.account).toBe('不明');
      expect(result.detailId).toBe(BigInt(123));
    });

    it('should handle negative amounts', () => {
      const deal: FreeDeal = {
        id: 123,
        issue_date: '2024-01-01',
        details: [{
          id: 456,
          amount: -1000,
          account_item_name: 'Test Account'
        }]
      };

      const result = createTransactionDataFromDeal(deal);
      expect(result.amount).toBe(1000); // 絶対値
    });

    it('should prioritize ref_number over memo for description', () => {
      const deal: FreeDeal = {
        id: 123,
        issue_date: '2024-01-01',
        ref_number: 'REF-001',
        memo: 'Test memo',
        details: [{
          id: 456,
          amount: 1000,
          description: 'Detail description'
        }]
      };

      const result = createTransactionDataFromDeal(deal);
      expect(result.description).toBe('REF-001');
    });

    it('should use detail description when ref_number and memo are missing', () => {
      const deal: FreeDeal = {
        id: 123,
        issue_date: '2024-01-01',
        details: [{
          id: 456,
          amount: 1000,
          description: 'Detail description'
        }]
      };

      const result = createTransactionDataFromDeal(deal);
      expect(result.description).toBe('Detail description');
    });
  });

  describe('isDebugEnabled', () => {
    it('should return true when in development with debug flag', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('FREEE_SYNC_DEBUG', 'true');
      
      expect(isDebugEnabled()).toBe(true);
    });

    it('should return false when not in development', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('FREEE_SYNC_DEBUG', 'true');
      
      expect(isDebugEnabled()).toBe(false);
    });

    it('should return false when debug flag is not set', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('FREEE_SYNC_DEBUG', 'false');
      
      expect(isDebugEnabled()).toBe(false);
    });

    it('should return false when debug flag is undefined', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.unstubAllEnvs();
      
      expect(isDebugEnabled()).toBe(false);
    });
  });
});