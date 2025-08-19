// JSONシリアライズ後の型定義（クライアント側で使用）
// サーバー側のDate型はクライアント側でstring型になる

import type { Grant, BudgetItem, Transaction } from './models';

// Date型をstring型に変換するユーティリティ型
export type Serialized<T> = T extends Date
  ? string
  : T extends object
  ? { [K in keyof T]: Serialized<T[K]> }
  : T;

// シリアライズされたGrant型
export type SerializedGrant = Serialized<Grant>;

// シリアライズされたBudgetItem型
export type SerializedBudgetItem = Serialized<BudgetItem>;

// シリアライズされたTransaction型
export type SerializedTransaction = Serialized<Transaction>;