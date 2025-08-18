/**
 * フィルター・ソートプリセット管理ユーティリティ
 */

export interface FilterPreset {
  id: string;
  name: string;
  filters: {
    // ヘッダーフィルター
    headerFilters: {
      primaryGrantName: string;
      primaryBudgetItemName: string;
      account: string;
      department: string;
      supplier: string;
      item: string;
      description: string;
      detailDescription: string;
      tags: string;
      minAmount: string;
      maxAmount: string;
      startDate: string;
      endDate: string;
    };
    // チェックボックスフィルター
    checkboxFilters: {
      allocationStatus: string[];
      account: string[];
      department: string[];
      supplier: string[];
      item: string[];
      primaryGrantName: string[];
      primaryBudgetItemName: string[];
    };
    // 左ペインフィルター
    budgetItemStatusFilter: string;
    budgetItemGrantFilter: string;
    budgetItemCategoryFilter: string;
  };
  sortConditions: {
    // 左ペインソート（予算項目）
    budgetItemSortFields: Array<{
      field: string;
      direction: 'asc' | 'desc';
    }>;
    // 取引テーブルソート
    transactionSortFields: Array<{
      field: string;
      direction: 'asc' | 'desc';
    }>;
  };
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilterPresetManager {
  presets: FilterPreset[];
  maxPresets: number;
}

const STORAGE_KEY = 'transaction-allocation-presets';
const MAX_PRESETS = 20;

/**
 * プリセット一覧を取得
 */
export function getPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const manager: FilterPresetManager = JSON.parse(stored);
    return manager.presets || [];
  } catch (error) {
    console.warn('プリセット読み込みエラー:', error);
    return [];
  }
}

/**
 * プリセットを保存
 */
export function savePreset(preset: Omit<FilterPreset, 'id' | 'createdAt' | 'updatedAt'>): string {
  const presets = getPresets();
  
  // 最大保存数チェック
  if (presets.length >= MAX_PRESETS) {
    throw new Error(`プリセットは最大${MAX_PRESETS}個まで保存できます`);
  }
  
  // 同じ名前のプリセットがあるかチェック
  if (presets.some(p => p.name === preset.name)) {
    throw new Error('同じ名前のプリセットが既に存在します');
  }
  
  const now = new Date().toISOString();
  const newPreset: FilterPreset = {
    ...preset,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
  
  presets.push(newPreset);
  
  const manager: FilterPresetManager = {
    presets,
    maxPresets: MAX_PRESETS
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(manager));
  return newPreset.id;
}

/**
 * プリセットを更新
 */
export function updatePreset(id: string, updates: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>): void {
  const presets = getPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) {
    throw new Error('プリセットが見つかりません');
  }
  
  // 名前の重複チェック（自分以外）
  if (updates.name && presets.some(p => p.id !== id && p.name === updates.name)) {
    throw new Error('同じ名前のプリセットが既に存在します');
  }
  
  presets[index] = {
    ...presets[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  const manager: FilterPresetManager = {
    presets,
    maxPresets: MAX_PRESETS
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(manager));
}

/**
 * プリセットを削除
 */
export function deletePreset(id: string): void {
  const presets = getPresets();
  const filteredPresets = presets.filter(p => p.id !== id);
  
  if (filteredPresets.length === presets.length) {
    throw new Error('プリセットが見つかりません');
  }
  
  const manager: FilterPresetManager = {
    presets: filteredPresets,
    maxPresets: MAX_PRESETS
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(manager));
}

/**
 * デフォルトプリセットを取得
 */
export function getDefaultPreset(): FilterPreset | null {
  const presets = getPresets();
  return presets.find(p => p.isDefault) || null;
}

/**
 * デフォルトプリセットを設定
 */
export function setDefaultPreset(id: string): void {
  const presets = getPresets();
  
  // 既存のデフォルトを解除
  presets.forEach(p => {
    p.isDefault = false;
  });
  
  // 新しいデフォルトを設定
  const preset = presets.find(p => p.id === id);
  if (preset) {
    preset.isDefault = true;
    preset.updatedAt = new Date().toISOString();
  }
  
  const manager: FilterPresetManager = {
    presets,
    maxPresets: MAX_PRESETS
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(manager));
}

/**
 * デフォルトプリセットを解除
 */
export function clearDefaultPreset(): void {
  const presets = getPresets();
  
  presets.forEach(p => {
    if (p.isDefault) {
      p.isDefault = false;
      p.updatedAt = new Date().toISOString();
    }
  });
  
  const manager: FilterPresetManager = {
    presets,
    maxPresets: MAX_PRESETS
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(manager));
}

/**
 * プリセットのエクスポート
 */
export function exportPresets(): string {
  const manager: FilterPresetManager = {
    presets: getPresets(),
    maxPresets: MAX_PRESETS
  };
  
  return JSON.stringify(manager, null, 2);
}

/**
 * プリセットのインポート
 */
export function importPresets(jsonData: string): void {
  try {
    const manager: FilterPresetManager = JSON.parse(jsonData);
    
    if (!manager.presets || !Array.isArray(manager.presets)) {
      throw new Error('無効なプリセットデータです');
    }
    
    // 既存プリセットとの名前重複チェック
    const existingPresets = getPresets();
    const duplicateNames = manager.presets
      .map(p => p.name)
      .filter(name => existingPresets.some(ep => ep.name === name));
    
    if (duplicateNames.length > 0) {
      throw new Error(`重複する名前のプリセットがあります: ${duplicateNames.join(', ')}`);
    }
    
    // インポート後の合計数チェック
    if (existingPresets.length + manager.presets.length > MAX_PRESETS) {
      throw new Error(`プリセット数が上限（${MAX_PRESETS}個）を超えます`);
    }
    
    // IDを再生成してインポート
    const now = new Date().toISOString();
    const importedPresets = manager.presets.map(preset => ({
      ...preset,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      isDefault: false // インポート時はデフォルト解除
    }));
    
    const allPresets = [...existingPresets, ...importedPresets];
    
    const newManager: FilterPresetManager = {
      presets: allPresets,
      maxPresets: MAX_PRESETS
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newManager));
  } catch (error) {
    throw new Error(`インポートエラー: ${error.message}`);
  }
}