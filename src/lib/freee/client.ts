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
      scope: 'read write',
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
    });

    if (startDate) {
      params.append('start_issue_date', startDate);
    }
    if (endDate) {
      params.append('end_issue_date', endDate);
    }

    const response = await fetch(`${this.config.baseUrl}/api/1/deals?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Get deals failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.deals;
  }

  // 仕訳データを取得
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