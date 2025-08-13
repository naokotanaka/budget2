import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  bigIntToString, 
  safeBigInt, 
  normalizeString, 
  normalizeAmount 
} from '../../../routes/api/freee/sync-selected/helpers';

describe('freee sync helpers', () => {
  describe('bigIntToString', () => {
    it('BigInt値を文字列に変換する', () => {
      const result = bigIntToString(BigInt(123456789));
      expect(result).toBe('123456789');
      expect(typeof result).toBe('string');
    });

    it('オブジェクト内のBigInt値を変換する', () => {
      const input = {
        id: BigInt(12345),
        name: 'test',
        nested: { value: BigInt(67890) }
      };
      const result = bigIntToString(input);
      expect(result).toEqual({
        id: '12345',
        name: 'test',
        nested: { value: '67890' }
      });
    });
  });

  describe('safeBigInt', () => {
    it('数値をBigIntに変換する', () => {
      expect(safeBigInt(123)).toBe(BigInt(123));
    });

    it('文字列をBigIntに変換する', () => {
      expect(safeBigInt('456')).toBe(BigInt(456));
    });

    it('変換できない値でエラーを投げる', () => {
      expect(() => safeBigInt(null)).toThrow();
      expect(() => safeBigInt({})).toThrow();
    });
  });

  describe('normalizeString', () => {
    it('nullを空文字列に変換する', () => {
      expect(normalizeString(null)).toBe('');
    });

    it('文字列の空白を削除する', () => {
      expect(normalizeString('  hello  ')).toBe('hello');
    });
  });

  describe('normalizeAmount', () => {
    it('nullを0に変換する', () => {
      expect(normalizeAmount(null)).toBe(0);
    });

    it('文字列を数値に変換する', () => {
      expect(normalizeAmount('123')).toBe(123);
    });

    it('BigIntを数値に変換する', () => {
      expect(normalizeAmount(BigInt(456))).toBe(456);
    });
  });
});