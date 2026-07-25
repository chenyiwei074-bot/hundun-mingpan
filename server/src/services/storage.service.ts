/**
 * 文件存储服务（抽象层）
 *
 * 当前实现：本地文件系统存储
 * 未来扩展：阿里云 OSS / 腾讯云 COS / Cloudflare R2
 *
 * 使用前配置环境变量（可选，默认本地存储）：
 *   STORAGE_PROVIDER=oss  # local | oss
 *   OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
 *   OSS_BUCKET=hundun-mindpan
 *   OSS_ACCESS_KEY_ID=xxx
 *   OSS_ACCESS_KEY_SECRET=xxx
 */

import * as fs from 'fs';
import * as path from 'path';

// ==================== 接口定义 ====================

export interface StorageProvider {
  /** 上传文件，返回公开访问 URL */
  uploadFile(key: string, content: Buffer | string, contentType?: string): Promise<string>;
  /** 获取文件公开 URL */
  getFileUrl(key: string): string;
  /** 删除文件 */
  deleteFile(key: string): Promise<void>;
}

// ==================== 本地存储实现 ====================

class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'public', 'storage');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadFile(key: string, content: Buffer | string, _contentType?: string): Promise<string> {
    const filePath = path.join(this.baseDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    return this.getFileUrl(key);
  }

  getFileUrl(key: string): string {
    return '/storage/' + key;
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// ==================== OSS 存储实现（预留） ====================

class OSSStorageProvider implements StorageProvider {
  private get endpoint() { return process.env.OSS_ENDPOINT || ''; }
  private get bucket() { return process.env.OSS_BUCKET || 'hundun-mindpan'; }
  private get accessKeyId() { return process.env.OSS_ACCESS_KEY_ID || ''; }
  private get accessKeySecret() { return process.env.OSS_ACCESS_KEY_SECRET || ''; }

  async uploadFile(key: string, content: Buffer | string, contentType?: string): Promise<string> {
    // TODO: 集成 ali-oss SDK
    // const OSS = require('ali-oss');
    // const client = new OSS({ ... });
    // await client.put(key, content, { mime: contentType });
    throw new Error('OSS storage not yet implemented. Install ali-oss and configure OSS_* env vars.');
  }

  getFileUrl(key: string): string {
    return 'https://' + this.bucket + '.' + this.endpoint.replace('https://', '') + '/' + key;
  }

  async deleteFile(key: string): Promise<void> {
    throw new Error('OSS storage not yet implemented.');
  }
}

// ==================== StorageService 统一入口 ====================

class StorageService {
  private provider: StorageProvider;

  constructor() {
    const providerName = process.env.STORAGE_PROVIDER || 'local';
    switch (providerName) {
      case 'oss':
        this.provider = new OSSStorageProvider();
        break;
      case 'local':
      default:
        this.provider = new LocalStorageProvider();
        break;
    }
    console.log('[Storage] Using provider:', providerName);
  }

  /** 上传海报 HTML，返回公开 URL */
  async uploadPoster(chartId: string, html: string): Promise<string> {
    return this.provider.uploadFile('posters/' + chartId + '.html', html, 'text/html; charset=utf-8');
  }

  /** 获取海报 URL */
  getPosterUrl(chartId: string): string {
    return this.provider.getFileUrl('posters/' + chartId + '.html');
  }

  /** 上传通用文件 */
  async upload(key: string, content: Buffer | string, contentType?: string): Promise<string> {
    return this.provider.uploadFile(key, content, contentType);
  }

  /** 获取文件 URL */
  getUrl(key: string): string {
    return this.provider.getFileUrl(key);
  }

  /** 删除文件 */
  async delete(key: string): Promise<void> {
    return this.provider.deleteFile(key);
  }
}

export const storage = new StorageService();
export default storage;
