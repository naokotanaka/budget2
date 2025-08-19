import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FreeeAPIClient } from '$lib/freee/client';
import { FreeeNameResolver } from '$lib/freee/name-resolver';
import { prisma } from '$lib/database';

// 環境変数から設定を取得
const FREEE_CLIENT_ID = process.env.FREEE_CLIENT_ID || '';
const FREEE_CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET || '';
const FREEE_REDIRECT_URI = process.env.FREEE_REDIRECT_URI || 'https://nagaiku.top/budget2/auth/freee/callback';
const FREEE_BASE_URL = process.env.FREEE_BASE_URL || 'https://api.freee.co.jp';

function getFreeeConfig() {
  return {
    clientId: FREEE_CLIENT_ID,
    clientSecret: FREEE_CLIENT_SECRET,
    redirectUri: FREEE_REDIRECT_URI,
    baseUrl: FREEE_BASE_URL
  };
}

// デバッグ用GETエンドポイント
export const GET: RequestHandler = async () => {
  console.log('=== GET Debug Request ===');
  
  // 固定パラメータでテスト
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return await processFreeeDataRequest(startDate, endDate, null);
};

export const POST: RequestHandler = async ({ request }) => {
  console.log('=== API /api/freee/data POST 開始 ===');
  console.log('Request Headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const requestBody = await request.json();
    const { startDate, endDate, companyId } = requestBody;
    
    console.log('リクエストボディ:', requestBody);
    return await processFreeeDataRequest(startDate, endDate, companyId);
  } catch (error: any) {
    console.error('POST request error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

// 共通のデータ処理関数
async function processFreeeDataRequest(startDate: string, endDate: string, companyId: number | null) {
  console.log('=== freee データ処理開始 ===');
  console.log('パラメータ:', { startDate, endDate, companyId });
    
  try {
    // バリデーション
    if (!startDate || !endDate) {
      return json({ 
        success: false, 
        error: '開始日と終了日は必須です' 
      }, { status: 400 });
    }
    
    // freee接続トークン取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!tokenRecord || new Date() >= tokenRecord.expiresAt) {
      return json({ 
        success: false, 
        error: 'freee接続が必要です。管理者にお問い合わせください。',
        needsSetup: true
      }, { status: 503 });
    }
    
    console.log('=== freee Token Info ===');
    console.log('Token scope:', tokenRecord.scope);
    console.log('Token expires at:', tokenRecord.expiresAt);
    console.log('Token type:', tokenRecord.tokenType);
    
    const client = new FreeeAPIClient(getFreeeConfig());
    const nameResolver = new FreeeNameResolver(client);
    let accessToken = tokenRecord.accessToken;
    
    // トークンの有効期限をチェック（近い場合はリフレッシュ）
    const expiryTime = new Date(tokenRecord.expiresAt).getTime();
    const currentTime = new Date().getTime();
    const timeUntilExpiry = expiryTime - currentTime;
    
    // 30分以内に期限切れの場合はリフレッシュ
    if (timeUntilExpiry < 30 * 60 * 1000) {
      try {
        console.log('トークンをリフレッシュ中...');
        const newToken = await client.refreshToken(tokenRecord.refreshToken);
        
        // 新しいトークンを保存
        await prisma.freeeToken.update({
          where: { id: tokenRecord.id },
          data: {
            accessToken: newToken.accessToken,
            refreshToken: newToken.refreshToken,
            expiresAt: newToken.expiresAt,
            tokenType: newToken.tokenType,
            scope: newToken.scope,
            updatedAt: new Date()
          }
        });

        accessToken = newToken.accessToken;
        console.log('トークンリフレッシュ完了');
      } catch (error: any) {
        console.error('トークンリフレッシュ失敗:', error);
        return json({ 
          success: false, 
          error: 'freee接続の更新に失敗しました。管理者にお問い合わせください。',
          needsSetup: true
        }, { status: 503 });
      }
    }
    
    // 会社情報を取得（companyIdが指定されていない場合）
    let selectedCompanyId = companyId;
    if (!selectedCompanyId) {
      try {
        const companies = await client.getCompanies(accessToken);
        if (companies.length === 0) {
          return json({ 
            success: false, 
            error: 'アクセス可能な会社が見つかりません' 
          }, { status: 400 });
        }
        selectedCompanyId = companies[0].id; // 最初の会社を使用
        console.log('使用する会社ID:', selectedCompanyId, companies[0].name);
      } catch (error: any) {
        console.error('会社情報取得エラー:', error);
        return json({ 
          success: false, 
          error: '会社情報の取得に失敗しました' 
        }, { status: 500 });
      }
    }
    
    // 取引データ（deals）をメインで使用 - 仕訳ID + 行番号で管理
    console.log('取引データ取得開始:', { companyId: selectedCompanyId, startDate, endDate });
    
    // 取引データを全件取得（ページネーション実装）
    let allDeals = [];
    let offset = 0;
    const limit = 100;
    let hasMoreData = true;

    console.log('=== 取引データ全件取得開始 ===');
    
    try {
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
      console.log('Deals取得成功:', allDeals.length, '件');
      
    } catch (dealsError) {
      console.error('Deals取得失敗:', dealsError);
      throw dealsError;
    }
    
    const deals = allDeals;
    console.log(`=== 最終取得件数: ${deals.length}件 ===`);
    
    // レシート情報を取得（取引との関連付けのため）
    console.log('=== レシート情報取得開始 ===');
    console.log(`取引数: ${deals.length}件のreceipt_ids取得を開始`);
    
    // 各取引に対してgetDealDetailを呼び出してreceipt_idsを取得
    let receiptCount = 0;
    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      try {
        console.log(`[${i+1}/${deals.length}] Deal ${deal.id} の詳細取得中...`);
        const dealDetail = await client.getDealDetail(
          accessToken,
          selectedCompanyId,
          deal.id
        );
        
        if (dealDetail && dealDetail.receipt_ids && dealDetail.receipt_ids.length > 0) {
          deals[i].receipt_ids = dealDetail.receipt_ids;
          receiptCount += dealDetail.receipt_ids.length;
          console.log(`✓ Deal ${deal.id}: ${dealDetail.receipt_ids.length}件のレシートID取得 => ${JSON.stringify(dealDetail.receipt_ids)}`);
        } else {
          console.log(`- Deal ${deal.id}: レシートなし`);
        }
        
        // APIレート制限を考慮して少し待機（100件ごとに長めの待機）
        if ((i + 1) % 100 === 0) {
          console.log(`API制限回避のため1秒待機...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error: any) {
        console.error(`Deal ${deal.id} の詳細取得エラー:`, error);
        // エラーがあっても処理を継続
      }
    }
    
    console.log(`=== レシート情報取得完了: 合計${receiptCount}件のレシートID ===`)
    
    // CSVベースの仕訳帳データ取得（詳細な取引内容とメモタグ用）
    console.log('=== 仕訳帳CSV取得開始（処理開始） ===');
    console.log('journals API呼び出し準備:', { selectedCompanyId, startDate, endDate });
    let journalCsvData = null;
    
    // 一時的に journals API をスキップして deals API のデータ構造を確認
    console.log('=== journals API は一時的にスキップ（deals API データ構造確認のため） ===');
    /* 
    try {
      console.log('=== 簡易journals API呼び出し中... ===');
      const journalData = await client.getJournals(
        accessToken,
        selectedCompanyId,
        startDate,
        endDate,
        500, // より多くのレコードを取得
        0
      );
      console.log('=== getJournalsComplete呼び出し完了 ===');
      journalCsvData = journalData;
      console.log(`=== 仕訳帳CSV取得完了: ${journalData ? journalData.length : '0'}行 ===`);
      
      // CSVデータから取引内容サンプルをログ出力
      if (journalData.length > 0) {
        console.log('=== CSVヘッダー確認 ===');
        console.log('Available keys:', Object.keys(journalData[0]));
        
        const sampleEntries = journalData.slice(0, 3);
        sampleEntries.forEach((entry, index) => {
          console.log(`=== 仕訳サンプル ${index + 1} ===`);
          console.log('取引内容:', entry['取引内容']);
          console.log('借方メモ:', entry['借方メモ']);
          console.log('管理番号:', entry['管理番号']);
          console.log('仕訳番号:', entry['仕訳番号']);
          console.log('取引ID:', entry['取引ID']);
        });
      } else {
        console.log('=== CSVデータが空です ===');
      }
    } catch (journalError) {
      console.error('=== JOURNALS CSV ERROR ===');
      console.error('仕訳帳CSV取得エラー:', journalError.message);
      console.error('エラー詳細:', journalError);
      // エラーがあっても処理を継続
    }
    */
    
    // 名前解決用のマスタデータを取得
    console.log('=== マスタデータ取得開始 ===');
    let accountItems = [];
    let partners = [];
    let sections = [];
    let items = [];
    let tags = [];
    
    try {
      [accountItems, partners, sections, items, tags] = await Promise.all([
        client.getAccountItems(accessToken, selectedCompanyId),
        client.getPartners(accessToken, selectedCompanyId),
        client.getSections(accessToken, selectedCompanyId),
        client.getItems(accessToken, selectedCompanyId),
        client.getTags(accessToken, selectedCompanyId)
      ]);
      
      console.log(`勘定科目: ${accountItems.length}件`);
      console.log(`取引先: ${partners.length}件`);
      console.log(`部門: ${sections.length}件`);
      console.log(`品目: ${items.length}件`);
      console.log(`タグ: ${tags.length}件`);
    } catch (masterError) {
      console.error('マスタデータ取得エラー:', masterError);
      // エラーがあっても処理を継続
    }
    
    // 名前解決用のマップを作成
    const accountItemMap = new Map(accountItems.map(item => [item.id, item.name]));
    const partnerMap = new Map(partners.map(partner => [partner.id, partner.name]));
    const sectionMap = new Map(sections.map(section => [section.id, section.name]));
    const itemMap = new Map(items.map(item => [item.id, item.name]));
    // タグマップは数値キーで作成（freee APIのtag_idsは数値）
    const tagMap = new Map(tags.map(tag => [tag.id, tag.name]));
    
    console.log(`${deals.length}件の取引データを取得`);
    
    // データ変換前のサンプルをログ出力
    if (deals.length > 0) {
      console.log('=== 変換前のfreee取引データサンプル ===');
      console.log('最初のdeal:', JSON.stringify(deals[0], null, 2));
    }
    
    // dealsデータを仕訳明細レベルに展開（一覧表示用）
    const transformedData = [];
    
    deals.forEach((deal, dealIndex) => {
      // 各取引の詳細（details）を個別の仕訳行として展開
      if (deal.details && Array.isArray(deal.details)) {
        deal.details.forEach((detail, detailIndex) => {
          const transformed = {
            // 基本識別情報
            id: detail.id, // 仕訳明細ID（既存システムとの整合性）
            deal_id: deal.id, // 元の取引ID
            line_number: detailIndex + 1, // 行番号（1から開始）
            company_id: deal.company_id,
            
            // 日付・金額情報
            issue_date: deal.issue_date,
            date: deal.issue_date,
            amount: detail.amount,
            amount_abs: Math.abs(detail.amount || 0),
            vat: detail.vat,
            
            // 取引内容
            description: detail.description || deal.ref_number || `取引 ${deal.id}`,
            entry_side: detail.entry_side,
            type: detail.entry_side === 'credit' ? 'income' : 'expense',
            
            // 取引先情報（後で名前解決）
            partner_id: deal.partner_id,
            partner_name: deal.partner_id ? `取引先ID: ${deal.partner_id}` : '取引先情報なし',
            partner_code: deal.partner_code,
            
            // 勘定科目情報（後で名前解決）
            account_item_id: detail.account_item_id,
            account_item_name: detail.account_item_id ? 
              `勘定科目ID: ${detail.account_item_id}` : '勘定科目情報なし',
            
            // 部門・タグ情報
            section_id: detail.section_id,
            item_id: detail.item_id,
            tag_ids: detail.tag_ids,
            // tag_idsからtag_namesへの変換（明細レベル）
            tag_names: detail.tag_ids && Array.isArray(detail.tag_ids) && detail.tag_ids.length > 0
              ? detail.tag_ids
                  .map(tagId => tagMap.get(tagId))
                  .filter(tagName => tagName !== undefined)
                  .join(', ')
              : null,
            tax_code: detail.tax_code,
            
            // 取引情報
            deal_type: deal.type,
            status: deal.status,
            due_date: deal.due_date,
            due_amount: deal.due_amount,
            ref_number: deal.ref_number,
            deal_origin_name: deal.deal_origin_name,
            
            // 取引レベルのタグ情報も保持（取引レベルにタグがある場合）
            deal_tag_ids: deal.tag_ids,
            deal_tag_names: deal.tag_ids && Array.isArray(deal.tag_ids) && deal.tag_ids.length > 0
              ? deal.tag_ids
                  .map(tagId => tagMap.get(tagId))
                  .filter(tagName => tagName !== undefined)
                  .join(', ')
              : null,
            
            // 振替情報
            transfer_id: deal.transfer_id || null,
            
            // 支払・領収書情報
            payments: deal.payments,
            receipts: deal.receipts,
            
            // 追加情報（存在する場合のみ）
            ...Object.keys(detail)
              .filter(key => !['id', 'account_item_id', 'tax_code', 'item_id', 'section_id', 'tag_ids', 'amount', 'vat', 'description', 'entry_side'].includes(key))
              .reduce((acc, key) => {
                acc[`detail_${key}`] = detail[key];
                return acc;
              }, {})
          };
          
          // 最初の数件の変換結果をログ出力
          if (dealIndex < 2 && detailIndex < 2) {
            console.log(`=== 変換後仕訳データ[${dealIndex}-${detailIndex}] ===`);
            console.log('Original deal keys:', Object.keys(deal));
            console.log('Original detail keys:', Object.keys(detail));
            console.log('Transformed keys:', Object.keys(transformed));
          }
          
          transformedData.push(transformed);
        });
      }
    });
    
    // 名前解決の実行（取引先名・勘定科目名を実際の名前に変換）
    console.log('=== 名前解決開始 ===');
    try {
      // 勘定科目の事前ロード
      await nameResolver.preloadAccountItems(accessToken, selectedCompanyId);
      
      // 各仕訳データの名前解決
      for (let i = 0; i < transformedData.length; i++) {
        const item = transformedData[i];
        
        // 取引先名の解決
        if (item.partner_id) {
          try {
            const partnerName = await nameResolver.getPartnerName(accessToken, selectedCompanyId, item.partner_id);
            transformedData[i].partner_name = partnerName;
          } catch (error: any) {
            console.warn(`取引先名解決失敗 (ID: ${item.partner_id}):`, error.message);
          }
        }
        
        // 勘定科目名の解決
        if (item.account_item_id) {
          try {
            const accountItemName = await nameResolver.getAccountItemName(accessToken, selectedCompanyId, item.account_item_id);
            transformedData[i].account_item_name = accountItemName;
          } catch (error: any) {
            console.warn(`勘定科目名解決失敗 (ID: ${item.account_item_id}):`, error.message);
          }
        }
        
        // 進捗表示（10件ごと）
        if ((i + 1) % 10 === 0) {
          console.log(`名前解決進捗: ${i + 1}/${transformedData.length}`);
        }
      }
      
      console.log('名前解決完了');
    } catch (nameResolverError) {
      console.error('名前解決エラー:', nameResolverError);
      // 名前解決に失敗してもデータは返す
    }
    
    // データベースへの保存処理
    console.log('=== transactionsテーブルへの保存開始 ===');
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    // 備考とメモタグを分離する関数
    function parseRemarkAndTags(description: string | null, deal: any): { remark: string | null, tags: string | null, detailDescription: string | null } {
      let remark = null;
      let tags = null;
      let detailDescription = null;

      // 明細レベルの備考を抽出
      if (deal.details && deal.details.length > 0) {
        detailDescription = deal.details[0]?.description || null;
      }

      // メモからタグを抽出
      if (deal.memo) {
        const tagMatches = deal.memo.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g);
        if (tagMatches) {
          tags = tagMatches.join(' ');
        }
        
        const remarkText = deal.memo.replace(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g, '').trim();
        if (remarkText) {
          remark = remarkText;
        }
      }

      if (description && description !== detailDescription) {
        remark = remark ? `${remark} ${description}` : description;
      }

      return { remark, tags, detailDescription };
    }
    
    // CSVデータから詳細情報を取得するためのマップを作成
    const journalDetailsMap = new Map();
    if (journalCsvData && journalCsvData.length > 0) {
      console.log('=== CSVヘッダー確認 ===');
      console.log('Available keys:', Object.keys(journalCsvData[0]));
      
      for (const entry of journalCsvData) {
        const dealId = entry['取引ID'];
        const lineNumber = entry['仕訳行番号'] || 1; // 行番号も考慮
        
        if (dealId) {
          // 取引IDと行番号の組み合わせでキーを作成
          const key = `${dealId}_${lineNumber}`;
          journalDetailsMap.set(dealId, {
            description: entry['取引内容'] || '',
            memo: entry['借方メモ'] || '',
            managementNumber: entry['管理番号'] || '',
            lineNumber: lineNumber
          });
          
          // デバッグ用ログ（最初の3件のみ）
          if (journalDetailsMap.size <= 3) {
            console.log(`=== CSV詳細マッピング ${journalDetailsMap.size} ===`);
            console.log('Deal ID:', dealId);
            console.log('Line Number:', lineNumber);
            console.log('取引内容:', entry['取引内容']);
            console.log('借方メモ:', entry['借方メモ']);
            console.log('管理番号:', entry['管理番号']);
          }
        }
      }
      console.log(`=== 仕訳詳細マップ作成完了: ${journalDetailsMap.size}件 ===`);
    } else {
      console.log('=== CSVデータなし、仕訳詳細マップはスキップ ===');
    }

    for (const deal of deals) {
      try {
        // CSVから詳細情報を取得
        const journalDetail = journalDetailsMap.get(deal.id);
        
        // デバッグ：取引データの構造を確認（取引内容関連）
        if (deal.id && syncedCount < 3) { // 最初の3件のみ詳細ログ
          console.log(`=== Deal ${deal.id} 取引内容確認 ===`);
          console.log('CSV取引内容:', journalDetail?.description);
          console.log('CSV借方メモ:', journalDetail?.memo);
          console.log('CSV管理番号:', journalDetail?.managementNumber);
          console.log('deal.ref_number:', deal.ref_number);
          console.log('deal.description:', deal.description);
          console.log('deal.memo:', deal.memo);
          console.log('deal details:', deal.details?.map(d => ({ 
            id: d.id, 
            description: d.description, 
            account_item_name: d.account_item_name 
          })));
        }
        
        // 既存の取引をチェック
        const existingTransaction = await prisma.transaction.findUnique({
          where: { id: `freee_${deal.id}` }
        });

        const { remark, tags, detailDescription } = parseRemarkAndTags(deal.details[0]?.description, deal);
        
        // deals APIから取引内容を適切に抽出
        let dealsDescription = '';
        
        // 1. deal.descriptionから取得を試行
        if (deal.description && deal.description.trim()) {
          dealsDescription = deal.description.trim();
        }
        // 2. 詳細の最初のdescriptionから取得を試行
        else if (deal.details && deal.details.length > 0 && deal.details[0].description && deal.details[0].description.trim()) {
          dealsDescription = deal.details[0].description.trim();
        }
        // 3. パートナー名から取得を試行
        else if (deal.partner_name && deal.partner_name.trim()) {
          dealsDescription = deal.partner_name.trim();
        }
        // 4. 勘定科目名から取得を試行  
        else if (deal.details && deal.details.length > 0 && deal.details[0].account_item_name) {
          dealsDescription = `${deal.details[0].account_item_name}取引`;
        }
        // 5. 最終フォールバック
        else {
          dealsDescription = `取引 ${deal.id}`;
        }
        
        // CSVデータがある場合は優先して使用、なければ deals API から抽出した内容
        const finalDescription = journalDetail?.description || dealsDescription;
        const finalTags = journalDetail?.memo || tags;
        const finalManagementNumber = journalDetail?.managementNumber || deal.ref_number || null;
        
        // レシートIDをJSON文字列として保存
        const receiptIdsJson = deal.receipt_ids && deal.receipt_ids.length > 0 
          ? JSON.stringify(deal.receipt_ids) 
          : null;

        // 明細IDを取得
        const detailId = deal.details && deal.details.length > 0 
          ? deal.details[0].id 
          : null;

        if (existingTransaction) {
          // 既存の取引を更新
          await prisma.transaction.update({
            where: { id: `freee_${deal.id}` },
            data: {
              journalNumber: deal.id,
              journalLineNumber: 1,
              date: new Date(deal.issue_date),
              description: finalDescription,
              amount: Math.abs(deal.amount),
              account: deal.details[0]?.account_item_name || 
                      (deal.details[0]?.account_item_id ? accountItemMap.get(deal.details[0].account_item_id) || `勘定科目ID:${deal.details[0].account_item_id}` : '勘定科目未設定'),
              supplier: deal.partner_name || 
                       (deal.partner_id ? partnerMap.get(deal.partner_id) || `取引先ID:${deal.partner_id}` : '取引先未設定'),
              department: deal.details[0]?.section_name || 
                         (deal.details[0]?.section_id ? sectionMap.get(deal.details[0].section_id) || null : null),
              item: deal.details[0]?.item_name || 
                   (deal.details[0]?.item_id ? itemMap.get(deal.details[0].item_id) || null : null),
              memo: deal.memo || '※freee APIから詳細情報を取得できませんでした',
              remark: remark,
              managementNumber: finalManagementNumber,
              freeDealId: deal.id,
              tags: finalTags,
              detailDescription: detailDescription,
              detailId: detailId ? BigInt(detailId) : null,
              receiptIds: receiptIdsJson,
              updatedAt: new Date()
            }
          });
        } else {
          // 新しい取引を作成
          await prisma.transaction.create({
            data: {
              id: `freee_${deal.id}`,
              journalNumber: deal.id,
              journalLineNumber: 1,
              date: new Date(deal.issue_date),
              description: finalDescription,
              amount: Math.abs(deal.amount),
              account: deal.details[0]?.account_item_name || 
                      (deal.details[0]?.account_item_id ? accountItemMap.get(deal.details[0].account_item_id) || `勘定科目ID:${deal.details[0].account_item_id}` : '勘定科目未設定'),
              supplier: deal.partner_name || 
                       (deal.partner_id ? partnerMap.get(deal.partner_id) || `取引先ID:${deal.partner_id}` : '取引先未設定'),
              department: deal.details[0]?.section_name || 
                         (deal.details[0]?.section_id ? sectionMap.get(deal.details[0].section_id) || null : null),
              item: deal.details[0]?.item_name || 
                   (deal.details[0]?.item_id ? itemMap.get(deal.details[0].item_id) || null : null),
              memo: deal.memo || '※freee APIから詳細情報を取得できませんでした',
              remark: remark,
              managementNumber: finalManagementNumber,
              freeDealId: deal.id,
              tags: finalTags,
              detailDescription: detailDescription,
              detailId: detailId ? BigInt(detailId) : null,
              receiptIds: receiptIdsJson
            }
          });
        }

        syncedCount++;
      } catch (error: any) {
        errorCount++;
        errors.push(`取引ID ${deal.id}: ${error.message}`);
        console.error(`取引保存エラー (ID: ${deal.id}):`, error);
      }
    }
    
    console.log(`=== 保存完了: ${syncedCount}件成功, ${errorCount}件エラー ===`);
    
    const responseData = {
      success: true,
      data: transformedData,
      count: transformedData.length,
      message: `${transformedData.length}件のデータを取得し、${syncedCount}件をデータベースに保存しました`,
      syncedCount,
      errorCount
    };
    
    console.log('=== API レスポンス送信 ===');
    console.log('Response Status: 200');
    console.log('Response Data Count:', transformedData.length);
    console.log('Response Success:', responseData.success);
    
    return json(responseData);
    
  } catch (error: any) {
    console.error('=== API エラー発生 ===');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('freeeデータ取得エラー:', error);
    
    // エラーの詳細をログに記録
    let errorMessage = 'データ取得中にエラーが発生しました';
    if (error.message?.includes('401')) {
      errorMessage = 'freee認証エラーです。管理者にお問い合わせください。';
    } else if (error.message?.includes('429')) {
      errorMessage = 'freee APIの利用制限に達しました。しばらく待ってから再試行してください。';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'freee APIとの通信に失敗しました。ネットワーク接続を確認してください。';
    }
    
    const errorResponse = { 
      success: false, 
      error: errorMessage,
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
    
    console.log('=== API エラーレスポンス送信 ===');
    console.log('Response Status: 500');
    console.log('Error Response:', errorResponse);
    
    return json(errorResponse, { status: 500 });
  }
}