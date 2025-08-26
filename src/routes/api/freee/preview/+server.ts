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
      selectedCompanyId = companies[0].id;
    }

    // マスタデータを並列取得（タグも追加）
    console.log('=== マスタデータ取得開始 ===');
    const [accountItemsResponse, sectionsResponse, partnersResponse, itemsResponse, tagsResponse] = await Promise.all([
      fetch(
        `${FREEE_BASE_URL}/api/1/account_items?company_id=${selectedCompanyId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      ),
      fetch(
        `${FREEE_BASE_URL}/api/1/sections?company_id=${selectedCompanyId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      ),
      fetch(
        `${FREEE_BASE_URL}/api/1/partners?company_id=${selectedCompanyId}&limit=3000`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      ),
      fetch(
        `${FREEE_BASE_URL}/api/1/items?company_id=${selectedCompanyId}&limit=3000`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      ),
      fetch(
        `${FREEE_BASE_URL}/api/1/tags?company_id=${selectedCompanyId}&limit=3000`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
    ]);

    const accountItemsData = await accountItemsResponse.json();
    const sectionsData = await sectionsResponse.json();
    const partnersData = await partnersResponse.json();
    const itemsData = await itemsResponse.json();
    const tagsData = await tagsResponse.json();

    // マスタデータマップを作成
    const accountItemMap = new Map<number, string>();
    const sectionMap = new Map<number, string>();
    const partnerMap = new Map<number, string>();
    const itemMap = new Map<number, string>();
    // タグマップは数値キーで作成（freee APIのtag_idsは数値）
    const tagMap = new Map<number, string>();
    
    if (accountItemsData.account_items) {
      accountItemsData.account_items.forEach((item: any) => {
        accountItemMap.set(item.id, item.name);
      });
      console.log(`勘定科目マスタ取得完了: ${accountItemMap.size}件`);
    }

    if (sectionsData.sections) {
      sectionsData.sections.forEach((section: any) => {
        sectionMap.set(section.id, section.name);
      });
      console.log(`部門マスタ取得完了: ${sectionMap.size}件`);
    }

    if (partnersData.partners) {
      partnersData.partners.forEach((partner: any) => {
        partnerMap.set(partner.id, partner.name);
      });
      console.log(`取引先マスタ取得完了: ${partnerMap.size}件`);
    }

    if (itemsData.items) {
      itemsData.items.forEach((item: any) => {
        itemMap.set(item.id, item.name);
      });
      console.log(`品目マスタ取得完了: ${itemMap.size}件`);
    }

    if (tagsData.tags) {
      tagsData.tags.forEach((tag: any) => {
        tagMap.set(tag.id, tag.name);
      });
      console.log(`タグマスタ取得完了: ${tagMap.size}件`);
    }

    // Wallet Txnsと取引データを並列取得
    console.log('=== Wallet Txnsと取引データの並列取得開始 ===');
    
    // Wallet Txnsを全件取得（ページネーション対応）
    let allWalletTxns = [];
    let walletOffset = 0;
    const walletLimit = 100;
    let hasMoreWalletData = true;

    while (hasMoreWalletData) {
      console.log(`Wallet Txnsページ取得中: offset=${walletOffset}, limit=${walletLimit}`);
      
      const walletTxns = await client.getWalletTxns(
        accessToken,
        selectedCompanyId,
        startDate,
        endDate,
        walletLimit,
        walletOffset
      );

      allWalletTxns = allWalletTxns.concat(walletTxns);
      console.log(`Wallet Txnsこのページで取得: ${walletTxns.length}件, 累計: ${allWalletTxns.length}件`);

      if (walletTxns.length < walletLimit) {
        hasMoreWalletData = false;
        console.log('Wallet Txns全データ取得完了');
      } else {
        walletOffset += walletLimit;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Wallet Txnsマップを作成（日付+金額でキー作成）
    const walletTxnMap = new Map<string, any>();
    allWalletTxns.forEach((txn: any) => {
      const key = `${txn.date}_${Math.abs(txn.amount)}`;
      if (!walletTxnMap.has(key)) {
        walletTxnMap.set(key, []);
      }
      walletTxnMap.get(key)!.push(txn);
    });
    console.log(`Wallet Txnマップ作成完了: ${walletTxnMap.size}種類のキー`);

    // 取引データを取得（ページネーション実装）
    let allDeals = [];
    let offset = 0;
    const limit = 100;
    let hasMoreData = true;

    console.log('=== 取引データ取得開始 ===');
    
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

      // 支出取引のみフィルタリング（収入を除外）
      const expenseDeals = deals.filter((deal: any) => {
        return deal.type === 'expense' || deal.amount < 0;
      });

      // マスタデータから名前を補完 & Wallet Txnsとマッチング
      const enrichedDeals = expenseDeals.map((deal: any) => {
        // 取引先名を補完（partner_idがnullでない場合のみ）
        if (deal.partner_id !== null && deal.partner_id !== undefined) {
          const resolvedPartnerName = partnerMap.get(deal.partner_id);
          if (resolvedPartnerName) {
            deal.partner_name = resolvedPartnerName;
          } else {
            deal.partner_name = `Unknown (ID: ${deal.partner_id})`;
          }
        } else {
          // partner_idがnullの場合、レシート情報から取引先名を取得を試みる
          if (deal.receipts && deal.receipts.length > 0) {
            const receiptPartnerName = deal.receipts[0]?.receipt_metadatum?.partner_name;
            if (receiptPartnerName) {
              deal.partner_name = receiptPartnerName;
            } else {
              deal.partner_name = 'No Partner';
            }
          } else {
            deal.partner_name = 'No Partner';
          }
        }

        // Wallet Txnsとマッチング試行
        const matchKey = `${deal.issue_date}_${Math.abs(deal.amount)}`;
        const matchedWalletTxns = walletTxnMap.get(matchKey);
        
        if (matchedWalletTxns && matchedWalletTxns.length > 0) {
          // マッチした場合、wallet_txnの情報を優先
          const walletTxn = matchedWalletTxns[0]; // 最初のマッチを使用
          deal.wallet_description = walletTxn.description;
          deal.wallet_matched = true;
          deal.walletable_type = walletTxn.walletable_type;
          deal.walletable_id = walletTxn.walletable_id;
          console.log(`Deal ${deal.id} matched with Wallet Txn: "${walletTxn.description}"`);
        } else {
          deal.wallet_matched = false;
        }

        // タグ名を補完（deal レベル）
        if (deal.tag_ids && Array.isArray(deal.tag_ids) && deal.tag_ids.length > 0) {
          const tagNames = deal.tag_ids
            .map((tagId: number) => tagMap.get(tagId))
            .filter(Boolean); // undefined/null を除外
          deal.tag_names = tagNames.join(', ');
          if (tagNames.length > 0) {
            console.log(`Deal ${deal.id} tags: [${deal.tag_ids.join(', ')}] => "${deal.tag_names}"`);
          }
        } else {
          deal.tag_names = '';
        }

        if (deal.details && deal.details.length > 0) {
          deal.details = deal.details.map((detail: any) => {
            // 勘定科目名を補完
            if (!detail.account_item_name && detail.account_item_id) {
              detail.account_item_name = accountItemMap.get(detail.account_item_id) || 'Unknown';
            }
            
            // 部門名を補完
            if (!detail.section_name && detail.section_id) {
              detail.section_name = sectionMap.get(detail.section_id) || 'Unknown';
            }
            
            // 品目名を補完
            if (!detail.item_name && detail.item_id) {
              const itemName = itemMap.get(detail.item_id);
              if (!itemName) {
                console.log(`品目ID ${detail.item_id} が品目マスタに見つかりません`);
              }
              detail.item_name = itemName || '';  // Unknownではなく空文字にする
            }
            
            // タグ名を補完（detail レベル）
            if (detail.tag_ids && Array.isArray(detail.tag_ids) && detail.tag_ids.length > 0) {
              const tagNames = detail.tag_ids
                .map((tagId: number) => tagMap.get(tagId))
                .filter(Boolean);
              detail.tag_names = tagNames.join(', ');
            } else {
              detail.tag_names = '';
            }
            
            return detail;
          });
        }
        return deal;
      });

      // 【事】【管】勘定科目を含む取引のみフィルタリング（全明細をチェック）
      const filteredDeals = enrichedDeals.filter((deal: any) => {
        if (deal.details && deal.details.length > 0) {
          // すべての明細行をチェックして、【事】または【管】が含まれているか確認
          return deal.details.some((detail: any) => {
            const accountName = detail.account_item_name || '';
            return accountName.startsWith('【事】') || accountName.startsWith('【管】');
          });
        }
        return false;
      });
      
      // 各取引の明細ごとに分割（【事】【管】の明細のみ）
      const dealsWithDetailInfo: any[] = [];
      filteredDeals.forEach((deal: any) => {
        if (deal.details && deal.details.length > 0) {
          deal.details.forEach((detail: any, index: number) => {
            const accountName = detail.account_item_name || '';
            // 【事】【管】の明細のみを個別の取引として追加
            if (accountName.startsWith('【事】') || accountName.startsWith('【管】')) {
              dealsWithDetailInfo.push({
                ...deal,
                // 明細ごとの金額を使用（取引全体の金額ではなく）
                amount: detail.amount || 0,
                // この明細のIDを行識別子として使用
                primary_detail_id: detail.id || null,
                // 明細が複数ある場合の情報
                detail_count: deal.details.length,
                // 明細インデックス（0始まり）
                detail_index: index,
                // この明細を最初の要素として配置（互換性のため）
                details: [detail, ...deal.details.filter((d: any, i: number) => i !== index)]
              });
            }
          });
        }
      });

      allDeals = allDeals.concat(dealsWithDetailInfo);
      console.log(`このページで取得: ${deals.length}件 → 支出のみ: ${expenseDeals.length}件 → 【事】【管】含む取引: ${filteredDeals.length}件 → 明細分割後: ${dealsWithDetailInfo.length}件, 累計: ${allDeals.length}件`);
      
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

    console.log(`=== 最終取得件数: ${allDeals.length}件 ===`);

    // 元の順序を保持するためのインデックスを追加
    // 発生日昇順→取引ID昇順でソート済みのデータに連番を付与
    const dealsWithIndex = allDeals.map((deal, index) => ({
      ...deal,
      original_index: index + 1  // 1から始まる行番号
    }));
    
    // 最初の5件の行番号割り当てをログ出力（確認用）
    if (dealsWithIndex.length > 0) {
      console.log('=== 行番号割り当て確認（最初の5件） ===');
      dealsWithIndex.slice(0, 5).forEach(deal => {
        console.log(`行番号 ${deal.original_index}: 取引ID ${deal.id}, 明細ID ${deal.primary_detail_id}, 発生日 ${deal.issue_date}, 金額 ${deal.amount}`);
      });
    }

    return json({
      success: true,
      deals: dealsWithIndex,
      totalCount: dealsWithIndex.length
    });

  } catch (error: any) {
    console.error('freeeプレビューエラー:', error);
    return json({ 
      success: false, 
      error: `プレビュー取得でエラーが発生しました: ${error.message}` 
    }, { status: 500 });
  }
};