/**
 * freee ID から名前を解決するユーティリティ
 * 将来的にパフォーマンスを向上させるために、キャッシュ機能も含む
 */

import type { FreeeAPIClient } from './client';

interface NameCache {
  partners: Map<number, string>;
  accountItems: Map<number, string>;
  lastUpdated: Date;
}

const cache: NameCache = {
  partners: new Map(),
  accountItems: new Map(),
  lastUpdated: new Date()
};

const CACHE_DURATION = 30 * 60 * 1000; // 30分

export class FreeeNameResolver {
  private client: FreeeAPIClient;
  
  constructor(client: FreeeAPIClient) {
    this.client = client;
  }
  
  /**
   * 取引先IDから取引先名を取得
   */
  async getPartnerName(accessToken: string, companyId: number, partnerId: number): Promise<string> {
    if (this.isCacheValid() && cache.partners.has(partnerId)) {
      return cache.partners.get(partnerId)!;
    }
    
    try {
      // freee API: GET /api/1/partners/{id}
      const response = await fetch(`https://api.freee.co.jp/api/1/partners/${partnerId}?company_id=${companyId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const name = data.partner?.name || `取引先ID: ${partnerId}`;
        cache.partners.set(partnerId, name);
        return name;
      }
    } catch (error) {
      console.warn('取引先名の取得に失敗:', error);
    }
    
    return `取引先ID: ${partnerId}`;
  }
  
  /**
   * 勘定科目IDから勘定科目名を取得
   */
  async getAccountItemName(accessToken: string, companyId: number, accountItemId: number): Promise<string> {
    if (this.isCacheValid() && cache.accountItems.has(accountItemId)) {
      return cache.accountItems.get(accountItemId)!;
    }
    
    try {
      // freee API: GET /api/1/account_items
      const response = await fetch(`https://api.freee.co.jp/api/1/account_items?company_id=${companyId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const accountItem = data.account_items?.find((item: any) => item.id === accountItemId);
        if (accountItem) {
          const name = accountItem.name;
          cache.accountItems.set(accountItemId, name);
          return name;
        }
      }
    } catch (error) {
      console.warn('勘定科目名の取得に失敗:', error);
    }
    
    return `勘定科目ID: ${accountItemId}`;
  }
  
  /**
   * 複数の取引データに対して一括で名前解決
   */
  async resolveNamesForDeals(accessToken: string, companyId: number, deals: any[]): Promise<any[]> {
    console.log('名前解決開始:', deals.length, '件');
    
    // まず勘定科目の一覧を取得（一回のAPI呼び出しで全て取得）
    await this.preloadAccountItems(accessToken, companyId);
    
    const resolved = await Promise.all(deals.map(async (deal) => {
      const partnerName = deal.partner_id ? 
        await this.getPartnerName(accessToken, companyId, deal.partner_id) : 
        '取引先情報なし';
      
      const accountItemName = deal.account_item_id ? 
        await this.getAccountItemName(accessToken, companyId, deal.account_item_id) : 
        '勘定科目情報なし';
      
      return {
        ...deal,
        partner_name: partnerName,
        account_item_name: accountItemName
      };
    }));
    
    console.log('名前解決完了');
    return resolved;
  }
  
  /**
   * 勘定科目一覧を事前に読み込み
   */
  async preloadAccountItems(accessToken: string, companyId: number): Promise<void> {
    if (this.isCacheValid() && cache.accountItems.size > 0) {
      return; // キャッシュが有効
    }
    
    try {
      const response = await fetch(`https://api.freee.co.jp/api/1/account_items?company_id=${companyId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        data.account_items?.forEach((item: any) => {
          cache.accountItems.set(item.id, item.name);
        });
        cache.lastUpdated = new Date();
        console.log('勘定科目キャッシュ更新:', cache.accountItems.size, '件');
      }
    } catch (error) {
      console.warn('勘定科目一覧の取得に失敗:', error);
    }
  }
  
  /**
   * キャッシュが有効かどうかチェック
   */
  private isCacheValid(): boolean {
    return Date.now() - cache.lastUpdated.getTime() < CACHE_DURATION;
  }
  
  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    cache.partners.clear();
    cache.accountItems.clear();
    cache.lastUpdated = new Date(0);
  }
}