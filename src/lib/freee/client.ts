export interface FreeeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl: string;
}

export interface FreeeToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string;
}

export interface FreeeTransaction {
  id: number;
  company_id: number;
  issue_date: string;
  due_date: string | null;
  amount: number;
  due_amount: number;
  type: 'income' | 'expense';
  partner_name: string | null;
  details: FreeeTransactionDetail[];
  ref_number: string | null;
  description: string | null;
  memo: string | null;
  receipt_ids: number[];
  receipts?: FreeeReceipt[];
}

export interface FreeeReceipt {
  id: number;
  company_id: number;
  description: string;
  receipt_metadatum?: {
    partner_name?: string;
    issue_date?: string;
    amount?: number;
  };
  file_src?: string;
  mime_type?: string;
  created_at: string;
  deal_id?: number;
}

export interface FreeeTransactionDetail {
  id: number;
  account_item_id: number;
  account_item_name: string;
  section_id: number | null;
  section_name: string | null;
  item_id: number | null;
  item_name: string | null;
  amount: number;
  description: string | null;
}

export interface FreeeCompany {
  id: number;
  name: string;
  name_kana: string;
  display_name: string;
  role: string;
}

export class FreeeAPIClient {
  private config: FreeeConfig;

  constructor(config: FreeeConfig) {
    this.config = config;
  }

  // OAuth2認証URL生成
  generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'read write companies deals walletables manual_journals',
      state: state
    });

    // OAuth2認証エンドポイントは別ドメイン
    return `https://accounts.secure.freee.co.jp/public_api/authorize?${params.toString()}`;
  }

  // 認証コードからアクセストークンを取得
  async exchangeCodeForToken(code: string): Promise<FreeeToken> {
    // OAuth2トークンエンドポイントは別ドメイン
    const tokenUrl = 'https://accounts.secure.freee.co.jp/public_api/token';
    
    // リクエストボディを構築
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: code,
      redirect_uri: this.config.redirectUri,
    });
    
    console.log('Token exchange request:', {
      url: tokenUrl,
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      codeLength: code.length
    });
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      });
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response:', responseText);
      throw new Error('Invalid JSON response from freee API');
    }
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope
    };
  }

  // リフレッシュトークンでアクセストークンを更新
  async refreshToken(refreshToken: string): Promise<FreeeToken> {
    const tokenUrl = 'https://accounts.secure.freee.co.jp/public_api/token';
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope
    };
  }

  // 会社情報を取得
  async getCompanies(accessToken: string): Promise<FreeeCompany[]> {
    const response = await fetch(`${this.config.baseUrl}/api/1/companies`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Get companies failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.companies;
  }

  // 取引データを取得
  async getDeals(
    accessToken: string, 
    companyId: number, 
    startDate?: string, 
    endDate?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<FreeeTransaction[]> {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      limit: limit.toString(),
      offset: offset.toString(),
      // freee APIは 'all' を受け付けないので、typeパラメータを除外
      // 全ての取引を取得する場合はtypeパラメータを指定しない
    });

    // 詳細データを取得するためのパラメータ
    // accruals: 'with' で勘定科目名を含む詳細情報を取得
    params.append('accruals', 'with');

    if (startDate) {
      params.append('start_issue_date', startDate);
    }
    if (endDate) {
      params.append('end_issue_date', endDate);
    }

    const url = `${this.config.baseUrl}/api/1/deals?${params.toString()}`;
    console.log('=== freee API Request ===');
    console.log('URL:', url);
    console.log('Headers:', {
      'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
      'Content-Type': 'application/json'
    });
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('=== freee API Response ===');
    console.log('Status:', response.status);
    console.log('StatusText:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('freee API Error Response:', errorText);
      throw new Error(`Get deals failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('=== Deals API Response Structure ===');
    console.log('Response keys:', Object.keys(data));
    console.log('Deals count:', Array.isArray(data.deals) ? data.deals.length : 'Not array');
    
    // 最初のdealを完全にログ出力
    if (Array.isArray(data.deals) && data.deals.length > 0) {
      console.log('=== FULL First Deal Data ===');
      console.log(JSON.stringify(data.deals[0], null, 2));
    }
    
    // 取得されたデータのフィールド内容をログ出力（最初の3件のみ）
    if (Array.isArray(data.deals) && data.deals.length > 0) {
      console.log('=== Sample Deal Data ===');
      data.deals.slice(0, 3).forEach((deal, index) => {
        console.log(`Deal ${index + 1}:`, {
          id: deal.id,
          description: deal.description,
          memo: deal.memo,
          ref_number: deal.ref_number,
          partner_name: deal.partner_name,
          receipt_ids: deal.receipt_ids,
          details: deal.details?.map(detail => ({
            account_item_name: detail.account_item_name,
            item_name: detail.item_name,
            description: detail.description,
            section_name: detail.section_name
          }))
        });
      });
    }
    
    return data.deals;
  }

  // 勘定科目名を取得
  async getAccountItems(accessToken: string, companyId: number): Promise<any[]> {
    const url = `${this.config.baseUrl}/api/1/account_items?company_id=${companyId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Get account items failed: ${response.status}`);
    }

    const data = await response.json();
    return data.account_items;
  }

  // 取引先情報を取得
  async getPartners(accessToken: string, companyId: number): Promise<any[]> {
    const url = `${this.config.baseUrl}/api/1/partners?company_id=${companyId}&limit=3000`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Get partners failed: ${response.status}`);
    }

    const data = await response.json();
    return data.partners;
  }

  // 部門情報を取得
  async getSections(accessToken: string, companyId: number): Promise<any[]> {
    const url = `${this.config.baseUrl}/api/1/sections?company_id=${companyId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Get sections failed: ${response.status}`);
    }

    const data = await response.json();
    return data.sections;
  }

  // 品目情報を取得
  async getItems(accessToken: string, companyId: number): Promise<any[]> {
    const url = `${this.config.baseUrl}/api/1/items?company_id=${companyId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Get items failed: ${response.status}`);
    }

    const data = await response.json();
    return data.items;
  }

  // 仕訳データを取得（詳細な取引内容・メモタグ用）
  async getJournals(
    accessToken: string, 
    companyId: number, 
    startDate?: string, 
    endDate?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      limit: limit.toString(),
      offset: offset.toString(),
      download_type: 'csv', // 必須パラメータを追加
    });

    if (startDate) {
      params.append('start_issue_date', startDate);
    }
    if (endDate) {
      params.append('end_issue_date', endDate);
    }

    const url = `${this.config.baseUrl}/api/1/journals?${params.toString()}`;
    console.log('=== freee Journals API Request ===');
    console.log('URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('=== freee Journals API Response ===');
    console.log('Status:', response.status);
    console.log('StatusText:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('freee Journals API Error Response:', errorText);
      throw new Error(`Get journals failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('=== Journals API Response Structure ===');
    console.log('Response keys:', Object.keys(data));
    console.log('Journals count:', Array.isArray(data.journals) ? data.journals.length : 'Not array');
    
    // 最初のjournalを完全にログ出力
    if (Array.isArray(data.journals) && data.journals.length > 0) {
      console.log('=== FULL First Journal Data ===');
      console.log(JSON.stringify(data.journals[0], null, 2));
    }
    
    return data.journals || [];
  }

  // 仕訳データをCSVダウンロード用にリクエスト（Journals API - generic_v2で仕訳番号取得）
  async requestJournalsDownload(
    accessToken: string,
    companyId: number,
    startDate?: string,
    endDate?: string
  ): Promise<{ id: number; status: string }> {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      download_type: 'generic_v2', // 仕訳番号取得のため
    });

    if (startDate) {
      params.append('start_date', startDate);
    }
    if (endDate) {
      params.append('end_date', endDate);
    }

    console.log('=== freee Journals CSV Download Request ===');
    console.log('URL:', `${this.config.baseUrl}/api/1/journals/reports?${params.toString()}`);

    const response = await fetch(`${this.config.baseUrl}/api/1/journals/reports?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Journals Download Request Error:', errorText);
      throw new Error(`Journals download request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Journals Download Response:', data);
    
    return {
      id: data.id,
      status: data.status
    };
  }

  // 仕訳ダウンロードの処理状況を確認
  async checkJournalsDownloadStatus(
    accessToken: string,
    companyId: number,
    downloadId: number
  ): Promise<{ status: string; downloadUrl?: string }> {
    const url = `${this.config.baseUrl}/api/1/journals/reports/${downloadId}?company_id=${companyId}`;
    
    console.log('=== freee Journals Download Status Check ===');
    console.log('URL:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Journals Status Check Error:', errorText);
      throw new Error(`Journals status check failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Journals Status Response:', data);
    
    return {
      status: data.status,
      downloadUrl: data.download_url
    };
  }

  // CSVファイルをダウンロードして解析
  async downloadAndParseJournalsCSV(
    accessToken: string,
    downloadUrl: string
  ): Promise<any[]> {
    console.log('=== freee Journals CSV Download ===');
    console.log('Download URL:', downloadUrl);

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`CSV download failed: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    console.log('CSV Content Length:', csvText.length);
    console.log('First 500 chars:', csvText.substring(0, 500));

    // CSVを解析（簡易版）
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    console.log('CSV Headers:', headers);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      if (values.length >= headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    }

    console.log('Parsed Rows:', rows.length);
    return rows;
  }

  // 仕訳データを完全取得（非同期処理込み）
  async getJournalsComplete(
    accessToken: string,
    companyId: number,
    startDate?: string,
    endDate?: string,
    maxWaitTime: number = 60000 // 1分に短縮
  ): Promise<any[]> {
    console.log('=== freee Journals Complete Process ===');
    
    // ダウンロードリクエスト
    const downloadInfo = await this.requestJournalsDownload(
      accessToken,
      companyId,
      startDate,
      endDate
    );

    console.log('Download requested:', downloadInfo);

    // ステータスチェックと完了待ち
    const startTime = Date.now();
    let status = downloadInfo.status;
    let downloadUrl = null;

    while (status !== 'completed' && (Date.now() - startTime) < maxWaitTime) {
      console.log(`Waiting for completion... Status: ${status}, Elapsed: ${Math.floor((Date.now() - startTime) / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機に短縮

      const statusInfo = await this.checkJournalsDownloadStatus(
        accessToken,
        companyId,
        downloadInfo.id
      );

      status = statusInfo.status;
      downloadUrl = statusInfo.downloadUrl;

      if (status === 'completed' && downloadUrl) {
        break;
      }
    }

    if (status !== 'completed' || !downloadUrl) {
      throw new Error(`Journals download timeout or failed. Status: ${status}`);
    }

    console.log('Download completed, downloading CSV...');

    // CSVダウンロードと解析
    const journalData = await this.downloadAndParseJournalsCSV(
      accessToken,
      downloadUrl
    );

    console.log('Journals data parsed:', journalData.length, 'entries');
    return journalData;
  }

  // 入出金データを取得（Wallet Txns API）
  async getWalletTxns(
    accessToken: string,
    companyId: number,
    startDate?: string,
    endDate?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (startDate) {
      params.append('start_date', startDate);
    }
    if (endDate) {
      params.append('end_date', endDate);
    }

    console.log('=== freee Wallet Transactions API ===');
    console.log('URL:', `${this.config.baseUrl}/api/1/wallet_txns?${params.toString()}`);

    const response = await fetch(`${this.config.baseUrl}/api/1/wallet_txns?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Wallet Txns API Error:', errorText);
      throw new Error(`Get wallet transactions failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Wallet Txns Response keys:', Object.keys(data));
    console.log('Wallet Txns count:', Array.isArray(data.wallet_txns) ? data.wallet_txns.length : 'Not array');
    
    return data.wallet_txns || [];
  }

  // 口座・現金残高を取得（旧getWalletables）
  async getWalletables(
    accessToken: string,
    companyId: number,
    startDate?: string,
    endDate?: string,
    limit: number = 100
  ): Promise<any[]> {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      limit: limit.toString(),
    });

    if (startDate) {
      params.append('start_date', startDate);
    }
    if (endDate) {
      params.append('end_date', endDate);
    }

    const response = await fetch(`${this.config.baseUrl}/api/1/walletables?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Get walletables failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.walletables;
  }

  // レシート一覧を取得
  async getReceipts(
    accessToken: string,
    companyId: number,
    dealId?: number,
    startDate?: string,
    endDate?: string,
    limit: number = 100
  ): Promise<FreeeReceipt[]> {
    // 日付範囲を設定（デフォルトは過去1年）
    if (!startDate || !endDate) {
      const endDateObj = new Date();
      const startDateObj = new Date();
      startDateObj.setFullYear(endDateObj.getFullYear() - 1);
      
      startDate = startDate || startDateObj.toISOString().split('T')[0];
      endDate = endDate || endDateObj.toISOString().split('T')[0];
    }

    const params = new URLSearchParams({
      company_id: companyId.toString(),
      start_date: startDate,
      end_date: endDate,
      limit: limit.toString()
    });

    console.log('=== freee Receipts API ===');
    console.log('URL:', `${this.config.baseUrl}/api/1/receipts?${params.toString()}`);

    const response = await fetch(`${this.config.baseUrl}/api/1/receipts?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Receipts API Error:', errorText);
      throw new Error(`Get receipts failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Receipts Response keys:', Object.keys(data));
    console.log('Receipts count:', Array.isArray(data.receipts) ? data.receipts.length : 'Not array');
    
    let receipts = data.receipts || [];

    // 特定の取引IDでフィルタリング
    if (dealId) {
      receipts = receipts.filter((receipt: FreeeReceipt) => receipt.deal_id === dealId);
      console.log(`Filtered receipts for deal_id ${dealId}:`, receipts.length);
    }

    return receipts;
  }

  // タグ（メモタグ）情報を取得
  async getTags(accessToken: string, companyId: number): Promise<any[]> {
    const url = `${this.config.baseUrl}/api/1/tags?company_id=${companyId}`;
    console.log('=== freee Tags API ===');
    console.log('URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tags API Error:', errorText);
      throw new Error(`Get tags failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Tags Response keys:', Object.keys(data));
    console.log('Tags count:', Array.isArray(data.tags) ? data.tags.length : 'Not array');
    
    return data.tags || [];
  }

  // レシート詳細を取得
  async getReceiptDetail(
    accessToken: string,
    companyId: number,
    receiptId: number
  ): Promise<FreeeReceipt | null> {
    const params = new URLSearchParams({
      company_id: companyId.toString()
    });

    console.log('=== freee Receipt Detail API ===');
    console.log('URL:', `${this.config.baseUrl}/api/1/receipts/${receiptId}?${params.toString()}`);

    const response = await fetch(`${this.config.baseUrl}/api/1/receipts/${receiptId}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Receipt Detail API Error:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('Receipt Detail Response:', data);
    
    return data.receipt || null;
  }

  // Deal詳細を取得（レシート情報含む）
  async getDealDetail(
    accessToken: string,
    companyId: number,
    dealId: number
  ): Promise<FreeeTransaction | null> {
    const params = new URLSearchParams({
      company_id: companyId.toString()
    });

    console.log('=== freee Deal Detail API ===');
    console.log('URL:', `${this.config.baseUrl}/api/1/deals/${dealId}?${params.toString()}`);

    const response = await fetch(`${this.config.baseUrl}/api/1/deals/${dealId}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deal Detail API Error:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('Deal Detail Response keys:', Object.keys(data));
    
    if (data.deal) {
      // レシート情報を並行取得
      if (data.deal.receipt_ids && data.deal.receipt_ids.length > 0) {
        console.log('Fetching receipt details for deal:', data.deal.receipt_ids);
        
        const receiptPromises = data.deal.receipt_ids.map((receiptId: number) =>
          this.getReceiptDetail(accessToken, companyId, receiptId)
        );

        try {
          const receipts = await Promise.all(receiptPromises);
          data.deal.receipts = receipts.filter(Boolean); // null要素を除去
          console.log('Loaded receipts for deal:', data.deal.receipts.length);
        } catch (error) {
          console.error('Failed to load receipt details:', error);
          data.deal.receipts = [];
        }
      }
      
      return data.deal;
    }
    
    return null;
  }
}