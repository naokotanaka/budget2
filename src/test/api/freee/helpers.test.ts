import { describe, it, expect } from 'vitest';
import { 
  bigIntToString, 
  safeBigInt, 
  normalizeString, 
  normalizeAmount 
} from '../../../routes/api/freee/sync-selected/helpers';

describe('bigIntToString helper', () => {
  it('BigInt値を文字列に変換する', () => {
    const result = bigIntToString(BigInt(123456789));
    expect(result).toBe('123456789');
    expect(typeof result).toBe('string');
  });

  it('BigIntの配列を文字列の配列に変換する', () => {
    const input = [BigInt(111), BigInt(222), BigInt(333)];
    const result = bigIntToString(input);
    expect(result).toEqual(['111', '222', '333']);
  });

  it('オブジェクト内のBigInt値を文字列に変換する', () => {
    const input = {
      id: BigInt(12345),
      name: 'test',
      count: 100,
      nested: {
        value: BigInt(67890)
      }
    };
    const result = bigIntToString(input);
    expect(result).toEqual({
      id: '12345',
      name: 'test',
      count: 100,
      nested: {
        value: '67890'
      }
    });
  });

  it('BigIntが含まれていない値はそのまま返す', () => {
    const primitives = [null, undefined, 123, 'string', true];
    primitives.forEach(value => {
      expect(bigIntToString(value)).toBe(value);
    });
  });
});

describe('safeBigInt helper', () => {
  it('数値をBigIntに変換する', () => {
    const result = safeBigInt(123);
    expect(result).toBe(BigInt(123));
  });

  it('文字列をBigIntに変換する', () => {
    const result = safeBigInt('456789');
    expect(result).toBe(BigInt(456789));
  });

  it('既にBigIntの場合はそのまま返す', () => {
    const input = BigInt(999);
    const result = safeBigInt(input);
    expect(result).toBe(input);
  });

  it('変換できない値の場合はエラーを投げる', () => {
    const invalidValues = [null, undefined, {}, []];
    invalidValues.forEach(value => {
      expect(() => safeBigInt(value)).toThrow();
    });
  });

  it('空文字列の場合は0になる', () => {
    expect(safeBigInt('')).toBe(BigInt(0));
  });
});

describe('normalizeString helper', () => {
  it('nullを空文字列に変換する', () => {
    expect(normalizeString(null)).toBe('');
  });

  it('undefinedを空文字列に変換する', () => {
    expect(normalizeString(undefined)).toBe('');
  });

  it('文字列の前後の空白を削除する', () => {
    expect(normalizeString('  hello world  ')).toBe('hello world');
  });

  it('数値を文字列に変換する', () => {
    expect(normalizeString(123)).toBe('123');
    expect(normalizeString(0)).toBe('0');
  });
});

describe('normalizeAmount helper', () => {
  it('nullを0に変換する', () => {
    expect(normalizeAmount(null)).toBe(0);
  });

  it('undefinedを0に変換する', () => {
    expect(normalizeAmount(undefined)).toBe(0);
  });

  it('数値をそのまま返す', () => {
    expect(normalizeAmount(123)).toBe(123);
    expect(normalizeAmount(-456)).toBe(-456);
    expect(normalizeAmount(0)).toBe(0);
  });

  it('BigIntを数値に変換する', () => {
    expect(normalizeAmount(BigInt(789))).toBe(789);
    expect(normalizeAmount(BigInt(-123))).toBe(-123);
  });

  it('数値形式の文字列を数値に変換する', () => {
    expect(normalizeAmount('456')).toBe(456);
    expect(normalizeAmount('-789')).toBe(-789);
    expect(normalizeAmount('0')).toBe(0);
  });

  it('Infinityを0に変換する', () => {
    expect(normalizeAmount(Infinity)).toBe(0);
    expect(normalizeAmount(-Infinity)).toBe(0);
  });

  it('NaNを0に変換する', () => {
    expect(normalizeAmount(NaN)).toBe(0);
  });
});