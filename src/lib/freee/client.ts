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
  receipt_ids: number[];
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
    limit: number = 100
  ): Promise<FreeeTransaction[]> {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      limit: limit.toString(),
      // freee APIは 'all' を受け付けないので、typeパラメータを除外
      // 全ての取引を取得する場合はtypeパラメータを指定しない
    });

    // タグ情報を取得するためのパラメータ
    params.append('visible_tags[]', 'partner');    // 取引先タグ
    params.append('visible_tags[]', 'item');       // 品目タグ
    params.append('visible_tags[]', 'tag');        // メモタグ
    params.append('visible_tags[]', 'section');    // 部門タグ
    params.append('visible_tags[]', 'description'); // 備考欄
    params.append('visible_tags[]', 'wallet_txn_description'); // 明細の備考欄

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
    
    return data.deals;
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
    maxWaitTime: number = 300000 // 5分
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
      console.log(`Waiting for completion... Status: ${status}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒待機

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
}