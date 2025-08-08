-- 予算項目データの投入
-- まず既存の不正な助成金を削除して、正しいデータを投入

-- 不正な助成金を削除
DELETE FROM grants WHERE "grantCode" IN ('POPOLO', 'つながり10', 'WAM補', '日本財団', 'まんぷく', 'むすファミ', 'むす春');

-- 正しい助成金データを挿入
INSERT INTO grants (name, "grantCode", "totalAmount", "startDate", "endDate", status) VALUES
('WAM補助金', 'WAM2025', 7000000, '2025-04-01', '2026-03-31', 'in_progress'),
('つながり10', 'TSUNAGARI10', 305213, '2025-04-01', '2026-03-31', 'in_progress'),
('むす春', 'MUSU_HARU', 60000, '2025-04-01', '2025-05-31', 'in_progress'),
('むすファミ', 'MUSU_FAMI', 100000, '2025-04-01', '2025-06-30', 'in_progress'),
('まんぷく', 'MANPUKU', 1922280, '2025-04-01', '2026-03-31', 'in_progress'),
('日本財団', 'NIPPON', 470000, '2025-04-01', '2026-03-31', 'in_progress'),
('日財終了分', 'NIPPON_END', 396469, '2024-04-01', '2025-03-31', 'completed'),
('POPOLO', 'POPOLO', 3183200, '2025-04-01', '2026-03-31', 'in_progress')
ON CONFLICT DO NOTHING;

-- 助成金IDを取得して予算項目を挿入
DO $$
DECLARE
  v_wam_id INTEGER;
  v_tsunagari_id INTEGER;
  v_musu_haru_id INTEGER;
  v_musu_fami_id INTEGER;
  v_manpuku_id INTEGER;
  v_nippon_id INTEGER;
  v_nippon_end_id INTEGER;
  v_popolo_id INTEGER;
BEGIN
  -- 助成金IDを取得
  SELECT id INTO v_wam_id FROM grants WHERE "grantCode" = 'WAM2025';
  SELECT id INTO v_tsunagari_id FROM grants WHERE "grantCode" = 'TSUNAGARI10';
  SELECT id INTO v_musu_haru_id FROM grants WHERE "grantCode" = 'MUSU_HARU';
  SELECT id INTO v_musu_fami_id FROM grants WHERE "grantCode" = 'MUSU_FAMI';
  SELECT id INTO v_manpuku_id FROM grants WHERE "grantCode" = 'MANPUKU';
  SELECT id INTO v_nippon_id FROM grants WHERE "grantCode" = 'NIPPON';
  SELECT id INTO v_nippon_end_id FROM grants WHERE "grantCode" = 'NIPPON_END';
  SELECT id INTO v_popolo_id FROM grants WHERE "grantCode" = 'POPOLO';

  -- 既存の予算項目を削除（クリーンな状態から始める）
  DELETE FROM budget_items;

  -- WAM補助金の予算項目
  INSERT INTO budget_items ("grantId", name, category, "budgetedAmount", note) VALUES
  (v_wam_id, '消耗品費', '消耗・食材', 508000, NULL),
  (v_wam_id, '家賃', '家賃', 1141200, NULL),
  (v_wam_id, '印刷製本費', '固定', 39200, NULL),
  (v_wam_id, '光熱水費', '光熱', 342000, NULL),
  (v_wam_id, '雑役務費', 'ほか', 12000, NULL),
  (v_wam_id, '謝金', '謝金', 132000, NULL),
  (v_wam_id, '賃金（アルバイト）', '賃金', 2382600, NULL),
  (v_wam_id, '賃金（職員）', '賃金', 1920000, NULL),
  (v_wam_id, '通信運搬費', '通信', 498000, NULL),
  (v_wam_id, '保険料', '保険', 25000, NULL);

  -- つながり10の予算項目
  INSERT INTO budget_items ("grantId", name, category, "budgetedAmount", note) VALUES
  (v_tsunagari_id, '食材費', '食材', 216000, NULL),
  (v_tsunagari_id, '消耗品費', '消耗', 89127, NULL);

  -- むす春の予算項目
  INSERT INTO budget_items ("grantId", name, category, "budgetedAmount", note) VALUES
  (v_musu_haru_id, '食品購入費', '食材', 48000, NULL),
  (v_musu_haru_id, '消耗品費', '消耗', 12000, NULL);

  -- むすファミの予算項目
  INSERT INTO budget_items ("grantId", name, category, "budgetedAmount", note) VALUES
  (v_musu_fami_id, '食品購入費', '食材', 82600, '弁当❌'),
  (v_musu_fami_id, '消耗品費', '消耗', 17400, '食器プレート・割り箸など');

  -- まんぷくの予算項目
  INSERT INTO budget_items ("grantId", name, category, "budgetedAmount", note) VALUES
  (v_manpuku_id, '食材費', '食材', 1488000, NULL),
  (v_manpuku_id, '衛生用品', '消耗', 200280, NULL),
  (v_manpuku_id, 'レンタカー', 'レンタカー', 234000, NULL);

  -- 日本財団の予算項目
  INSERT INTO budget_items ("grantId", name, category, "budgetedAmount", note) VALUES
  (v_nippon_id, '学びフェス', '固定', 470000, NULL);

  -- 日財終了分の予算項目
  INSERT INTO budget_items ("grantId", name, category, "budgetedAmount", note) VALUES
  (v_nippon_end_id, '終了分', 'ほか', 396469, NULL);

  -- POPOLOの予算項目
  INSERT INTO budget_items ("grantId", name, category, "budgetedAmount", note) VALUES
  (v_popolo_id, '食料品費', '食材', 2092500, NULL),
  (v_popolo_id, '生活必需品・学用品', '消耗', 310500, NULL),
  (v_popolo_id, '人件費', '賃金', 360000, NULL),
  (v_popolo_id, 'レンタカー', 'レンタカー', 130000, NULL),
  (v_popolo_id, 'ガソリン代', 'ほか', 10200, NULL),
  (v_popolo_id, '人件費（諸謝金）', '賃金', 120000, NULL);

END $$;