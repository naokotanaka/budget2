/**
 * 日本語テキストファイルのエンコーディング検出・変換ユーティリティ
 */

export type SupportedEncoding = 'utf-8' | 'shift_jis' | 'euc-jp' | 'auto';

export interface EncodingDetectionResult {
  detectedEncoding: string;
  confidence: number;
  content: string;
  bom?: boolean;
}

export interface EncodingError extends Error {
  code: 'DETECTION_FAILED' | 'CONVERSION_FAILED' | 'UNSUPPORTED_ENCODING';
  originalEncoding?: string;
  targetEncoding?: string;
}

/**
 * エンコーディング検出器
 */
export class EncodingDetector {
  
  /**
   * テキストのエンコーディングを検出してUTF-8に変換
   */
  static async detectAndConvert(
    buffer: ArrayBuffer | Uint8Array,
    hintEncoding?: SupportedEncoding
  ): Promise<EncodingDetectionResult> {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    
    try {
      // BOMチェック
      const bomResult = this.checkBOM(bytes);
      if (bomResult) {
        return bomResult;
      }

      // ヒントエンコーディングが指定されている場合は優先
      if (hintEncoding && hintEncoding !== 'auto') {
        try {
          const content = this.decodeWithEncoding(bytes, hintEncoding);
          return {
            detectedEncoding: hintEncoding,
            confidence: 1.0,
            content
          };
        } catch (error) {
          // ヒントエンコーディングで失敗した場合は自動検出に移る
          console.warn(`指定されたエンコーディング ${hintEncoding} でのデコードに失敗:`, error);
        }
      }

      // 自動検出
      return await this.autoDetect(bytes);
    } catch (error) {
      const encodingError: EncodingError = new Error(`エンコーディング検出に失敗: ${error}`) as EncodingError;
      encodingError.code = 'DETECTION_FAILED';
      throw encodingError;
    }
  }

  /**
   * BOM（Byte Order Mark）をチェック
   */
  private static checkBOM(bytes: Uint8Array): EncodingDetectionResult | null {
    // UTF-8 BOM: EF BB BF
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      const contentBytes = bytes.slice(3);
      const content = new TextDecoder('utf-8').decode(contentBytes);
      return {
        detectedEncoding: 'utf-8',
        confidence: 1.0,
        content,
        bom: true
      };
    }

    // UTF-16 BE BOM: FE FF
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      const content = new TextDecoder('utf-16be').decode(bytes.slice(2));
      return {
        detectedEncoding: 'utf-16be',
        confidence: 1.0,
        content,
        bom: true
      };
    }

    // UTF-16 LE BOM: FF FE
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      const content = new TextDecoder('utf-16le').decode(bytes.slice(2));
      return {
        detectedEncoding: 'utf-16le',
        confidence: 1.0,
        content,
        bom: true
      };
    }

    return null;
  }

  /**
   * エンコーディング自動検出
   */
  private static async autoDetect(bytes: Uint8Array): Promise<EncodingDetectionResult> {
    const encodings: SupportedEncoding[] = ['utf-8', 'shift_jis', 'euc-jp'];
    const results: Array<{ encoding: string; confidence: number; content: string; error?: boolean }> = [];

    for (const encoding of encodings) {
      try {
        const content = this.decodeWithEncoding(bytes, encoding);
        const confidence = this.calculateConfidence(content, encoding);
        results.push({ encoding, confidence, content });
      } catch (error) {
        results.push({ encoding, confidence: 0, content: '', error: true });
      }
    }

    // 最も信頼度の高いエンコーディングを選択
    results.sort((a, b) => b.confidence - a.confidence);
    const bestResult = results[0];

    if (bestResult.confidence === 0) {
      throw new Error('すべてのエンコーディングでデコードに失敗しました');
    }

    return {
      detectedEncoding: bestResult.encoding,
      confidence: bestResult.confidence,
      content: bestResult.content
    };
  }

  /**
   * 指定されたエンコーディングでデコード
   */
  private static decodeWithEncoding(bytes: Uint8Array, encoding: SupportedEncoding): string {
    switch (encoding) {
      case 'utf-8':
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      
      case 'shift_jis':
        // Shift_JISは標準のTextDecoderでサポートされていない場合があるため、
        // ブラウザ環境では代替手段を使用
        try {
          return new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
        } catch {
          // フォールバック: 可能な限り UTF-8 として解釈
          return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        }
      
      case 'euc-jp':
        try {
          return new TextDecoder('euc-jp', { fatal: true }).decode(bytes);
        } catch {
          // フォールバック: 可能な限り UTF-8 として解釈
          return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        }
      
      default:
        throw new Error(`サポートされていないエンコーディング: ${encoding}`);
    }
  }

  /**
   * エンコーディングの信頼度を計算
   */
  private static calculateConfidence(content: string, encoding: string): number {
    let score = 0;

    // 基本スコア（エラーなくデコードできた）
    score += 0.3;

    // 日本語文字の存在チェック
    const japaneseChars = content.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
    if (japaneseChars) {
      score += 0.4;
      
      // ひらがな、カタカナ、漢字のバランスをチェック
      const hiragana = content.match(/[\u3040-\u309F]/g);
      const katakana = content.match(/[\u30A0-\u30FF]/g);
      const kanji = content.match(/[\u4E00-\u9FAF]/g);
      
      if (hiragana && katakana && kanji) {
        score += 0.2;
      }
    }

    // エンコーディング固有のチェック
    switch (encoding) {
      case 'utf-8':
        // UTF-8は最も広く使われているため、やや優遇
        score += 0.1;
        break;
      
      case 'shift_jis':
        // Shift_JISで特によく使われる文字があるかチェック
        if (content.includes('ー') || content.includes('。') || content.includes('、')) {
          score += 0.05;
        }
        break;
    }

    // 文字化けパターンのチェック（減点）
    if (content.includes('??') || content.includes('\uFFFD')) {
      score -= 0.3;
    }

    // 制御文字が多い場合は減点
    const controlChars = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g);
    if (controlChars && controlChars.length > content.length * 0.1) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * ファイルからエンコーディングを検出
   */
  static async detectFromFile(file: File, hintEncoding?: SupportedEncoding): Promise<EncodingDetectionResult> {
    const buffer = await file.arrayBuffer();
    return this.detectAndConvert(buffer, hintEncoding);
  }

  /**
   * 文字列をUTF-8バイト配列に変換
   */
  static encodeToUTF8(text: string): Uint8Array {
    return new TextEncoder().encode(text);
  }

  /**
   * サポートされているエンコーディングの一覧を取得
   */
  static getSupportedEncodings(): { value: SupportedEncoding; label: string; description: string }[] {
    return [
      {
        value: 'auto',
        label: '自動検出',
        description: 'ファイルの内容から自動的にエンコーディングを検出します'
      },
      {
        value: 'utf-8',
        label: 'UTF-8',
        description: 'Unicode標準エンコーディング（推奨）'
      },
      {
        value: 'shift_jis',
        label: 'Shift_JIS',
        description: 'Windows日本語環境で一般的なエンコーディング'
      },
      {
        value: 'euc-jp',
        label: 'EUC-JP',
        description: 'Unix/Linux日本語環境で使われるエンコーディング'
      }
    ];
  }
}

/**
 * CSVファイル専用のエンコーディング検出
 */
export class CSVEncodingDetector extends EncodingDetector {
  
  /**
   * CSVファイルのエンコーディングを検出（CSVヘッダーを考慮）
   */
  static async detectCSVEncoding(
    file: File | ArrayBuffer | Uint8Array,
    expectedHeaders?: string[]
  ): Promise<EncodingDetectionResult> {
    const bytes = file instanceof File ? 
      new Uint8Array(await file.arrayBuffer()) :
      file instanceof ArrayBuffer ?
      new Uint8Array(file) :
      file;

    const result = await this.detectAndConvert(bytes);
    
    // CSVヘッダーが期待される場合は追加検証
    if (expectedHeaders && expectedHeaders.length > 0) {
      const lines = result.content.split(/\r?\n/);
      if (lines.length > 0) {
        const firstLine = lines[0];
        const headers = firstLine.split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
        
        // 期待されるヘッダーとの一致度をチェック
        const matchCount = expectedHeaders.filter(expected => 
          headers.some(actual => actual === expected)
        ).length;
        
        const headerMatchRatio = matchCount / expectedHeaders.length;
        
        // ヘッダー一致度を信頼度に反映
        result.confidence = Math.min(1, result.confidence + (headerMatchRatio * 0.2));
      }
    }

    return result;
  }
}