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

// ヘルパー関数：備考とメモタグを分離
function parseRemarkAndTags(description: string | null, deal: any): { remark: string | null, tags: string | null, detailDescription: string | null } {
  let remark = null;
  let tags = null;
  let detailDescription = null;

  // 明細レベルの備考を抽出
  if (deal.details && deal.details.length > 0) {
    detailDescription = deal.details[0]?.description || null;
  }

  // メモからタグを抽出（現行システムの実装を参照）
  if (deal.memo) {
    // メモからタグ部分を抽出（例：#タグ1 #タグ2 のような形式）
    const tagMatches = deal.memo.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g);
    if (tagMatches) {
      tags = tagMatches.join(' ');
    }
    
    // タグ以外の部分を備考として抽出
    const remarkText = deal.memo.replace(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g, '').trim();
    if (remarkText) {
      remark = remarkText;
    }
  }

  // descriptionが別途ある場合は備考に追加
  if (description && description !== detailDescription) {
    remark = remark ? `${remark} ${description}` : description;
  }

  return { remark, tags, detailDescription };
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
      } catch (error) {
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
        // デバッグ用：取引データの詳細をログ出力
        console.log(`=== Processing Deal ID ${deal.id} ===`);
        console.log('Deal data:', {
          id: deal.id,
          description: deal.description,
          memo: deal.memo,
          ref_number: deal.ref_number,
          partner_name: deal.partner_name,
          type: deal.type,
          amount: deal.amount,
          receipt_ids: deal.receipt_ids,
          details: deal.details?.map(detail => ({
            account_item_name: detail.account_item_name,
            item_name: detail.item_name,
            description: detail.description,
            section_name: detail.section_name
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

        // 備考とメモタグを分離
        const { remark, tags, detailDescription } = parseRemarkAndTags(deal.details[0]?.description, deal);
        
        // レシートIDをJSON文字列として保存
        const receiptIdsJson = deal.receipt_ids && deal.receipt_ids.length > 0 
          ? JSON.stringify(deal.receipt_ids) 
          : null;

        // 勘定科目名を取得（マスタから取得）
        let accountName = '不明';
        if (deal.details && deal.details.length > 0) {
          const detail = deal.details[0];
          
          // デバッグ: 取得したデータを確認
          console.log(`=== 勘定科目取得 Deal ID: ${deal.id} ===`);
          console.log('  account_item_id:', detail.account_item_id);
          console.log('  account_item_name:', detail.account_item_name);
          
          // まずaccount_item_nameがあればそれを使用
          if (detail.account_item_name) {
            accountName = detail.account_item_name;
            console.log(`  ✅ account_item_nameから取得: ${accountName}`);
          } 
          // なければaccount_item_idからマスタを参照
          else if (detail.account_item_id) {
            const masterName = accountItemMap.get(detail.account_item_id);
            if (masterName) {
              accountName = masterName;
              console.log(`  ✅ マスタから取得: ${accountName}`);
            } else {
              console.log(`  ❌ 勘定科目マスタに存在しないID: ${detail.account_item_id}`);
            }
          }
          
          // それでも取得できない場合のデバッグ
          if (accountName === '不明') {
            console.log(`  ❌ 勘定科目が取得できません！`);
            console.log('  Detail全データ:', detail);
          }
          
          console.log(`  最終勘定科目名: ${accountName}`);
        } else {
          console.log(`⚠️ 明細データなし - Deal ID: ${deal.id}`);
        }

        // 共通のデータオブジェクト
        const transactionData = {
          journalNumber: BigInt(deal.id),
          journalLineNumber: 1,
          date: new Date(deal.issue_date),
          description: deal.description,
          amount: Math.abs(deal.amount),
          account: accountName,
          supplier: deal.partner_name,
          department: deal.details[0]?.section_name,
          item: deal.details[0]?.item_name || null,
          memo: deal.memo || null,
          remark: remark,
          managementNumber: deal.ref_number || null,
          freeDealId: BigInt(deal.id),
          tags: tags,
          detailDescription: detailDescription,
          detailId: BigInt(detailId),
          receiptIds: receiptIdsJson
        };

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
      } catch (error) {
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

  } catch (error) {
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