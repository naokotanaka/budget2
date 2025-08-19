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

export const GET: RequestHandler = async () => {
  try {
    // 保存されたトークンを取得
    const tokenRecord = await prisma.freeeToken.findFirst({
      where: { id: 1 }
    });

    if (!tokenRecord) {
      return json({ 
        success: false, 
        error: 'freeeの認証が必要です。' 
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
          error: 'トークンの更新に失敗しました。' 
        }, { status: 401 });
      }
    }

    // 会社情報を取得
    const companies = await client.getCompanies(accessToken);
    if (companies.length === 0) {
      return json({ 
        success: false, 
        error: 'アクセス可能な会社が見つかりません' 
      }, { status: 400 });
    }
    const companyId = companies[0].id;

    // マスタデータを取得
    const accountItems = await client.getAccountItems(accessToken, companyId);
    const accountItemMap = new Map<number, string>();
    accountItems.forEach(item => accountItemMap.set(item.id, item.name));

    const partners = await client.getPartners(accessToken, companyId);
    const partnerMap = new Map<number, string>();
    partners.forEach(partner => partnerMap.set(partner.id, partner.name));

    const items = await client.getItems(accessToken, companyId);
    const itemMap = new Map<number, string>();
    items.forEach(item => itemMap.set(item.id, item.name));

    const sections = await client.getSections(accessToken, companyId);
    const sectionMap = new Map<number, string>();
    sections.forEach(section => sectionMap.set(section.id, section.name));

    // 最新の3件の取引を取得してテスト
    const deals = await client.getDeals(
      accessToken, 
      companyId, 
      '2024-01-01', 
      '2024-12-31',
      3,  // 3件のみ取得
      0
    );

    // 最初の取引の完全なデータを確認
    if (deals.length > 0) {
      console.log('=== First Deal Full Data ===');
      console.log(JSON.stringify(deals[0], null, 2));
    }

    // マッピング結果を確認
    const mappingResults = deals.map(deal => {
      const detail = deal.details?.[0];
      
      // マスタデータから名前を取得
      const partnerName = deal.partner_id ? partnerMap.get(deal.partner_id) || null : null;
      const accountName = detail?.account_item_id ? accountItemMap.get(detail.account_item_id) || null : null;
      const itemName = detail?.item_id ? itemMap.get(detail.item_id) || null : null;
      const sectionName = detail?.section_id ? sectionMap.get(detail.section_id) || null : null;
      
      // 取引内容を構築
      const descParts = [];
      if (partnerName) descParts.push(partnerName);
      if (itemName) descParts.push(itemName);
      if (sectionName) descParts.push(`[${sectionName}]`);
      if (!detail?.description && accountName) {
        descParts.push(`(${accountName})`);
      }
      if (detail?.description) descParts.push(detail.description);
      
      const transactionDescription = descParts.join(' ') || accountName || '不明な取引';

      return {
        // freeeのオリジナルデータ
        original: {
          id: deal.id,
          ref_number: deal.ref_number,
          partner_id: deal.partner_id,
          partner_name: partnerName,  // マスタから取得
          issue_date: deal.issue_date,
          amount: deal.amount,
          memo: deal.memo,
          detail_description: detail?.description,
          account_item_id: detail?.account_item_id,
          account_item_name: accountName,  // マスタから取得
          item_id: detail?.item_id,
          item_name: itemName,  // マスタから取得
          section_id: detail?.section_id,
          section_name: sectionName  // マスタから取得
        },
        // 変換後のデータ
        mapped: {
          description: transactionDescription,  // 構築した取引内容
          managementNumber: deal.ref_number,   // 管理番号
          supplier: partnerName,         // 取引先名（マスタから）
          account: accountName,  // 勘定科目（マスタから）
          item: itemName,            // 品目（マスタから）
          department: sectionName,    // 部門（マスタから）
          memo: deal.memo,                     // メモ
          detailDescription: detail?.description // 明細の備考
        }
      };
    });

    return json({
      success: true,
      message: 'マッピングテスト完了',
      totalDeals: deals.length,
      mappingResults
    });

  } catch (error: any) {
    console.error('マッピングテストエラー:', error);
    return json({ 
      success: false, 
      error: `テストエラー: ${error.message}` 
    }, { status: 500 });
  }
};