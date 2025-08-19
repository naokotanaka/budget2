import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { prisma } from '$lib/database';
import { 
  FREEE_CLIENT_ID, 
  FREEE_CLIENT_SECRET, 
  FREEE_REDIRECT_URI, 
  FREEE_BASE_URL 
} from '$env/static/private';

// BigIntをJSON形式に変換するヘルパー関数
function bigIntToString(value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(bigIntToString);
  }
  if (value !== null && typeof value === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = bigIntToString(val);
    }
    return result;
  }
  return value;
}

// 安全にBigIntに変換するヘルパー関数
function safeBigInt(value: any): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return BigInt(value);
  }
  throw new Error(`Cannot convert ${typeof value} to BigInt: ${value}`);
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { startDate, endDate, companyId } = await request.json();

    // 保存されたトークンを取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      where: { id: 1 }
    });

    if (!tokenRecord) {
      return json({ 
        success: false, 
        error: 'freeeの認証が必要です。先に認証を完了してください。' 
      }, { status: 401 });
    }

    const client = new FreeeAPIClient({
      clientId: FREEE_CLIENT_ID,
      clientSecret: FREEE_CLIENT_SECRET,
      redirectUri: FREEE_REDIRECT_URI,
      baseUrl: FREEE_BASE_URL
    });

    let accessToken = tokenRecord.accessToken;

    // トークンの有効期限をチェック
    if (new Date() >= tokenRecord.expiresAt) {
      try {
        const newToken = await client.refreshToken(tokenRecord.refreshToken);
        
        // 新しいトークンを保存
        await prisma.freeeToken.update({
          where: { id: tokenRecord.id },
          data: {
            accessToken: newToken.accessToken,
            refreshToken: newToken.refreshToken,
            expiresAt: newToken.expiresAt,
            tokenType: newToken.tokenType,
            scope: newToken.scope
          }
        });

        accessToken = newToken.accessToken;
      } catch (error: any) {
        return json({ 
          success: false, 
          error: 'トークンの更新に失敗しました。再認証が必要です。' 
        }, { status: 401 });
      }
    }

    // 会社情報を取得（companyIdが指定されていない場合）
    let selectedCompanyId = companyId;
    if (!selectedCompanyId) {
      const companies = await client.getCompanies(accessToken);
      if (companies.length === 0) {
        return json({ 
          success: false, 
          error: 'アクセス可能な会社が見つかりません' 
        }, { status: 400 });
      }
      selectedCompanyId = companies[0].id; // 最初の会社を使用
    }

    // 勘定科目マスタを取得してIDと名前のマッピングを作成
    console.log('=== 勘定科目マスタ取得開始 ===');
    const accountItemsResponse = await fetch(
      `${FREEE_BASE_URL}/api/1/account_items?company_id=${selectedCompanyId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!accountItemsResponse.ok) {
      console.error('勘定科目マスタ取得エラー:', accountItemsResponse.status);
      return json({ 
        success: false, 
        error: '勘定科目マスタの取得に失敗しました' 
      }, { status: 500 });
    }

    const accountItemsData = await accountItemsResponse.json();
    const accountItemMap = new Map<number, string>();
    
    if (accountItemsData.account_items) {
      accountItemsData.account_items.forEach((item: any) => {
        accountItemMap.set(item.id, item.name);
      });
      console.log(`勘定科目マスタ取得完了: ${accountItemMap.size}件`);
    }

    // 取引先マスタを取得
    console.log('=== 取引先マスタ取得開始 ===');
    const partnersResponse = await fetch(
      `${FREEE_BASE_URL}/api/1/partners?company_id=${selectedCompanyId}&limit=3000`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const partnerMap = new Map<number, string>();
    if (partnersResponse.ok) {
      const partnersData = await partnersResponse.json();
      if (partnersData.partners) {
        partnersData.partners.forEach((partner: any) => {
          partnerMap.set(partner.id, partner.name);
        });
        console.log(`取引先マスタ取得完了: ${partnerMap.size}件`);
      }
    }

    // 品目マスタを取得
    console.log('=== 品目マスタ取得開始 ===');
    const itemsResponse = await fetch(
      `${FREEE_BASE_URL}/api/1/items?company_id=${selectedCompanyId}&limit=3000`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const itemMap = new Map<number, string>();
    if (itemsResponse.ok) {
      const itemsData = await itemsResponse.json();
      if (itemsData.items) {
        itemsData.items.forEach((item: any) => {
          itemMap.set(item.id, item.name);
          console.log(`  品目ID ${item.id}: ${item.name}`);
        });
        console.log(`品目マスタ取得完了: ${itemMap.size}件`);
      }
    } else {
      console.error('品目マスタの取得に失敗しました');
    }

    // 部門マスタを取得
    console.log('=== 部門マスタ取得開始 ===');
    const sectionsResponse = await fetch(
      `${FREEE_BASE_URL}/api/1/sections?company_id=${selectedCompanyId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const sectionMap = new Map<number, string>();
    if (sectionsResponse.ok) {
      const sectionsData = await sectionsResponse.json();
      if (sectionsData.sections) {
        sectionsData.sections.forEach((section: any) => {
          sectionMap.set(section.id, section.name);
          console.log(`  部門ID ${section.id}: ${section.name}`);
        });
        console.log(`部門マスタ取得完了: ${sectionMap.size}件`);
      }
    } else {
      console.error('部門マスタの取得に失敗しました');
    }

    // 取引データを全件取得（ページネーション実装）
    let allDeals = [];
    let offset = 0;
    const limit = 100;
    let hasMoreData = true;

    console.log('=== 取引データ全件取得開始 ===');
    
    while (hasMoreData) {
      console.log(`ページ取得中: offset=${offset}, limit=${limit}`);
      
      const deals = await client.getDeals(
        accessToken, 
        selectedCompanyId, 
        startDate, 
        endDate,
        limit,
        offset
      );

      allDeals = allDeals.concat(deals);
      console.log(`このページで取得: ${deals.length}件, 累計: ${allDeals.length}件`);
      
      // 取得件数がlimit未満の場合、これ以上データがないと判断
      if (deals.length < limit) {
        hasMoreData = false;
        console.log('全データ取得完了');
      } else {
        offset += limit;
        // APIレート制限を考慮して少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const deals = allDeals;
    console.log(`=== 最終取得件数: ${deals.length}件 ===`);

    // 同期開始ログを記録
    const syncRecord = await prisma.freeeSync.create({
      data: {
        lastSyncAt: new Date(),
        syncStatus: 'running',
        syncMessage: `同期開始: ${deals.length}件の取引を処理中`,
        recordCount: 0
      }
    });

    let syncedCount = 0;
    let errorCount = 0;
    let newCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    const errors: string[] = [];

    // 取引データをデータベースに保存
    for (const deal of deals) {
      try {
        // マスタデータから名前を取得
        const partnerName = deal.partner_id ? partnerMap.get(deal.partner_id) || null : null;
        const detail = deal.details?.[0];
        const accountName = detail?.account_item_id ? accountItemMap.get(detail.account_item_id) || '不明' : '不明';
        const itemName = detail?.item_id ? itemMap.get(detail.item_id) || null : null;
        const sectionName = detail?.section_id ? sectionMap.get(detail.section_id) || null : null;

        // デバッグ用：取引データの詳細をログ出力
        console.log(`=== Processing Deal ID ${deal.id} ===`);
        console.log('Deal data:', {
          id: deal.id,
          ref_number: deal.ref_number,  // 管理番号
          partner_id: deal.partner_id,
          partner_name: partnerName,  // 取引先名（マスタから取得）
          issue_date: deal.issue_date,  // 発生日
          type: deal.type,
          amount: deal.amount,
          memo: deal.memo,
          receipt_ids: deal.receipt_ids,
          details: deal.details?.map(d => ({
            id: d.id,  // 明細ID
            account_item_id: d.account_item_id,
            account_item_name: d.account_item_id ? accountItemMap.get(d.account_item_id) : null,  // 勘定科目名（マスタから取得）
            item_id: d.item_id,
            item_name: d.item_id ? itemMap.get(d.item_id) : null,  // 品目名（マスタから取得）
            description: d.description,  // 明細の備考
            section_id: d.section_id,
            section_name: d.section_id ? sectionMap.get(d.section_id) : null  // 部門名（マスタから取得）
          }))
        });

        // 明細IDを取得（最初の明細のIDを使用）
        const detailId = deal.details && deal.details.length > 0 
          ? deal.details[0].id 
          : null;
        
        // detailIdがない取引はスキップ（新しいスキーマでは必須）
        if (!detailId) {
          console.warn(`⚠️ 明細IDがない取引をスキップ: Deal ID ${deal.id}`);
          skipCount++;
          continue;
        }

        // 既存の取引をチェック（detailIdで検索）
        const existingTransaction = await prisma.transaction.findUnique({
          where: { detailId: BigInt(detailId) }
        });

        // レシートIDをJSON文字列として保存
        const receiptIdsJson = deal.receipt_ids && deal.receipt_ids.length > 0 
          ? JSON.stringify(deal.receipt_ids) 
          : null;

        // 勘定科目名の確認（既に上で取得済み）
        console.log(`=== 勘定科目取得 Deal ID: ${deal.id} ===`);
        console.log('  account_item_id:', detail?.account_item_id);
        console.log('  勘定科目名（マスタから）:', accountName);
        
        // 部門と品目の確認
        console.log(`=== 部門・品目取得 Deal ID: ${deal.id} ===`);
        console.log('  section_id:', detail?.section_id);
        console.log('  部門名（マスタから）:', sectionName);
        console.log('  item_id:', detail?.item_id);
        console.log('  品目名（マスタから）:', itemName);

        // freee APIから取得した各フィールドをそのまま使用（加工禁止）
        // description: freee APIのdeals APIにはdeal.descriptionフィールドは存在しないため、nullを設定
        const transactionDescription = null;
        
        // detailDescription: freee APIの明細レベルのdescriptionフィールド（details[0].description）
        const detailDescription = detail?.description || null;
        
        // tags: メモからハッシュタグを抽出（タグ抽出のみ許可）
        let tags = null;
        if (deal.memo) {
          const tagMatches = deal.memo.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g);
          if (tagMatches) {
            tags = tagMatches.join(' ');
          }
        }

        // 共通のデータオブジェクト
        const transactionData = {
          journalNumber: BigInt(deal.id),
          journalLineNumber: 1,
          date: new Date(deal.issue_date),
          description: transactionDescription,  // nullを設定（freee APIのdeals APIにはdescriptionフィールドが存在しないため）
          amount: Math.abs(deal.amount),
          account: accountName,  // account_item_idから変換した名前
          supplier: partnerName,  // partner_idから変換した名前
          department: sectionName,  // section_idから変換した名前
          item: itemName || null,  // item_idから変換した名前
          memo: deal.memo || null,  // freee APIのmemoをそのまま使用
          remark: null,  // remarkフィールドは使用しない（加工禁止）
          managementNumber: deal.ref_number || null,  // freee APIのref_numberをそのまま使用
          freeDealId: BigInt(deal.id),
          tags: tags,  // メモから抽出したタグのみ
          detailDescription: detailDescription,  // details[0].descriptionをそのまま使用
          detailId: BigInt(detailId),
          receiptIds: receiptIdsJson
        };
        
        // 保存前のデータ確認
        console.log(`=== 保存データ Deal ID: ${deal.id} ===`);
        console.log('  department:', transactionData.department);
        console.log('  item:', transactionData.item);

        if (existingTransaction) {
          // 既存の取引を更新
          await prisma.transaction.update({
            where: { id: existingTransaction.id },
            data: {
              ...transactionData,
              updatedAt: new Date()
            }
          });
          console.log(`Updated transaction: ${existingTransaction.id} (freeDealId: ${deal.id})`);
          updateCount++;
        } else {
          // 新しい取引を作成（IDはdetailIdを文字列化）
          await prisma.transaction.create({
            data: {
              id: `detail_${detailId}`,
              ...transactionData
            }
          });
          console.log(`Created new transaction: detail_${detailId} (freeDealId: ${deal.id})`);
          newCount++;
        }

        syncedCount++;
      } catch (error: any) {
        errorCount++;
        errors.push(`取引ID ${deal.id}: ${error.message}`);
        console.error(`取引同期エラー (ID: ${deal.id}):`, error);
        console.error('Deal data:', JSON.stringify(deal, null, 2));
      }
    }

    // 同期完了ログを更新
    await prisma.freeeSync.update({
      where: { id: syncRecord.id },
      data: {
        syncStatus: errorCount > 0 ? 'warning' : 'success',
        syncMessage: errorCount > 0 
          ? `同期完了（警告あり）: ${newCount}件新規, ${updateCount}件更新, ${errorCount}件エラー`
          : `同期完了: ${newCount}件新規, ${updateCount}件更新`,
        recordCount: syncedCount
      }
    });

    return json({
      success: true,
      message: `${newCount}件新規作成, ${updateCount}件更新, ${skipCount}件スキップしました`,
      syncedCount,
      newCount,
      updateCount,
      skipCount,
      errorCount,
      errors: errors.slice(0, 10) // 最初の10件のエラーのみ返す
    });

  } catch (error: any) {
    console.error('freee同期エラー:', error);
    
    // エラーログを記録
    try {
      await prisma.freeeSync.create({
        data: {
          lastSyncAt: new Date(),
          syncStatus: 'error',
          syncMessage: `同期エラー: ${error.message}`,
          recordCount: 0
        }
      });
    } catch (logError) {
      console.error('エラーログ記録失敗:', logError);
    }

    return json({ 
      success: false, 
      error: `同期処理でエラーが発生しました: ${error.message}` 
    }, { status: 500 });
  }
};