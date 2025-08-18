# 割当（AllocationSplit）のdetailId設計

## 重要な設計原則
**割当のdetailIdは取引（Transaction）から独立している**

### 設計意図
1. 割当は明細ID（detailId）を独立して保持する
2. 取引が削除・再作成されても、割当のdetailIdは変更されない
3. freeeの明細IDは不変なので、これを永続的なキーとして使用

### なぜこの設計が重要か
- freee同期で取引を削除・再作成しても割当データが保持される
- 明細IDが同じ取引が再作成されれば、自動的に関連が復活する
- ユーザーが入力した割当情報が失われない

### 絶対にやってはいけないこと
- `onDelete: SetNull`を使用する（取引削除時にdetailIdが消える）
- `onDelete: Cascade`を使用する（取引削除時に割当も消える）
- detailIdを取引に依存させる設計変更

### 正しいスキーマ
```prisma
model AllocationSplit {
  detailId     BigInt?
  transaction  Transaction? @relation(fields: [detailId], references: [detailId])
  // onDeleteは指定しない（独立性を保つ）
}
```

この設計により、取引データの更新に関わらず、ユーザーの割当作業が保護される。