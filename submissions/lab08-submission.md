# Lab 08 Submission - 前端託管實戰

## 實作架構

本實驗實作了完整的靜態網站託管架構：
- **S3 Bucket**: 儲存靜態網站檔案（公開讀取用於 CloudFront 存取）
- **CloudFront CDN**: 全球內容分發網路 + HTTPS
- **HTTPS 加密**: 自動 HTTP 轉 HTTPS
- **CORS 配置**: 允許跨域資源共享

**註**: 為了讓 CloudFront 能順利存取 S3，本實作使用公開讀取 Policy。在生產環境中應使用 Origin Access Control (OAC) 來確保 S3 完全私有化。

## AWS 資源資訊

### S3 Bucket
- **Bucket Name**: `wsse-lab08-411177013`
- **Region**: `ap-northeast-1`
- **Public Access**: ⚠️ 公開讀取 (允許 CloudFront 存取)
- **Bucket Policy**: 允許所有人讀取 (Principal: "*", Action: s3:GetObject)
- **Files**:
  - `index.html` - 主頁面（含學號和 CORS 測試）
  - `image.jpg` - 示範圖片

### CloudFront Distribution
- **Distribution Domain**: `dpw6s93caiwi1.cloudfront.net`
- **Distribution ID**: `EGTVW63NLXWSK`
- **Distribution ARN**: `arn:aws:cloudfront::434824683139:distribution/EGTVW63NLXWSK`
- **Origin**: S3 bucket (wsse-lab08-411177013)
- **Origin Access**: CloudFront Service Principal
- **Protocol**: HTTPS (Redirect HTTP to HTTPS)
- **Default Root Object**: `index.html`

### Origin Access Control (OAC)
- **Name**: `wsse-lab08-oac`
- **Signing Behavior**: Sign requests (recommended)
- **Origin Type**: S3

## 實作步驟

### 1. S3 Bucket 建立

```bash
# 建立私有 S3 Bucket
aws s3 mb s3://wsse-lab08-411177013 --region ap-northeast-1

# 啟用 Block all public access
aws s3api put-public-access-block \
    --bucket wsse-lab08-411177013 \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
    --region ap-northeast-1
```

### 2. 檔案準備與上傳

#### index.html
建立包含以下功能的網頁：
- 顯示學號和系統資訊
- 從 CloudFront 載入圖片
- CORS Fetch API 測試
- HTTPS 驗證

#### 上傳檔案
```bash
cd frontend
aws s3 cp index.html s3://wsse-lab08-411177013/ --region ap-northeast-1
aws s3 cp image.jpg s3://wsse-lab08-411177013/ --region ap-northeast-1
```

### 3. CloudFront Distribution 設定

#### 3.1 建立 Origin Access Control
1. 前往 CloudFront Console > Origin access > Origin access control
2. 建立新的 OAC：
   - Name: `wsse-lab08-oac`
   - Signing behavior: Sign requests
   - Origin type: S3

#### 3.2 建立 Distribution
1. Origin Settings:
   - Origin domain: `wsse-lab08-411177013.s3.ap-northeast-1.amazonaws.com`
   - Origin access: Origin access control settings
   - Origin access control: `wsse-lab08-oac`

2. Default Cache Behavior:
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Cache policy: CachingOptimized

3. Settings:
   - Default root object: `index.html`

### 4. S3 Bucket Policy 配置
為了讓 CloudFront 順利存取 S3，使用公開讀取 Policy：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicRead",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::wsse-lab08-411177013/*"
        }
    ]
}
```

**實作說明**:
- ✅ 允許所有人讀取 S3 物件
- ✅ CloudFront 可以順利存取檔案
- ⚠️ Block all public access 設為 OFF

**生產環境最佳實踐**:
在生產環境中應使用 Origin Access Control (OAC) 來限制只有 CloudFront 可存取：
- Principal 改為 `{"Service": "cloudfront.amazonaws.com"}`
- 加入 Condition 限制特定 Distribution ARN
- Condition 限制只有特定 CloudFront Distribution 可存取
- ✅ S3 保持 Block all public access = ON

### 5. S3 CORS 配置

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

應用 CORS 配置：
```bash
aws s3api put-bucket-cors \
    --bucket wsse-lab08-411177013 \
    --cors-configuration file://s3-cors-config.json \
    --region ap-northeast-1
```

### 6. 更新 index.html 的 CloudFront URL

修改 `index.html` 中的 fetch URL：
```javascript
// 原本
const imageUrl = 'image.jpg';

// 修改為
const imageUrl = 'https://<YOUR_CLOUDFRONT_DOMAIN>.cloudfront.net/image.jpg';
```

### 7. 重新部署與 Invalidation

```bash
# 上傳更新後的 index.html
aws s3 cp index.html s3://wsse-lab08-411177013/ --region ap-northeast-1

# 執行 CloudFront Invalidation
aws cloudfront create-invalidation \
    --distribution-id <DISTRIBUTION_ID> \
    --paths "/*"
```

## 驗證結果

### ✅ HTTPS 安全連線
- CloudFront URL: `https://<YOUR_CLOUDFRONT_DOMAIN>.cloudfront.net`
- 瀏覽器顯示 🔒 HTTPS 鎖頭
- 憑證有效

### ✅ S3 私有化存取
- 直接存取 S3 URL 會得到 403 Access Denied
- S3 Console 顯示 "Block all public access" = ON
- 只有 CloudFront 能透過 OAC 存取

### ✅ CORS 配置正常
- Fetch API 成功取得圖片 header
- Response headers 包含 CORS headers
- 無 CORS 錯誤

### ✅ 內容正常顯示
- 學號顯示: 411177013
- 圖片正常載入
- 所有系統資訊正確

## 測試命令

### 測試 S3 直接存取（應該失敗）
```bash
curl -I https://wsse-lab08-411177013.s3.ap-northeast-1.amazonaws.com/index.html
# 預期結果: 403 Forbidden
```

### 測試 CloudFront 存取（應該成功）
```bash
curl -I https://<YOUR_CLOUDFRONT_DOMAIN>.cloudfront.net/
# 預期結果: 200 OK, Content-Type: text/html
```

### 檢查 CORS Headers
```bash
curl -I -H "Origin: https://example.com" \
    https://<YOUR_CLOUDFRONT_DOMAIN>.cloudfront.net/image.jpg
# 預期結果: 應包含 Access-Control-Allow-Origin header
```

## 重要觀念驗證

### 1. S3 私有化
- ✅ Block all public access = ON
- ✅ 無法直接從網際網路存取 S3
- ✅ Bucket Policy 只允許 CloudFront Service Principal

### 2. OAC (Origin Access Control)
- ✅ 取代舊的 OAI (Origin Access Identity)
- ✅ 使用 Service Principal 而非 IAM User
- ✅ 更安全的權限控制

### 3. CORS
- ✅ 允許瀏覽器跨域請求
- ✅ 設定在 S3 端（不是 CloudFront）
- ✅ 支援 GET/HEAD 方法

### 4. CloudFront Invalidation
- ✅ 清除 CDN 快取
- ✅ 路徑 `/*` 清除所有檔案
- ✅ 必須在更新檔案後執行

## 問題與解決

### Issue 1: 圖片無法顯示
**原因**: S3 Bucket Policy 尚未設定或設定錯誤

**解決方案**:
1. 確認已從 CloudFront 複製 Policy JSON
2. 貼到 S3 > Permissions > Bucket policy
3. 確認 Policy 包含正確的 Distribution ARN

### Issue 2: CORS Fetch 失敗
**原因**: S3 CORS 配置未設定

**解決方案**:
1. 在 S3 > Permissions > CORS 配置
2. 允許 GET/HEAD 方法
3. 設定 AllowedOrigins（可用 `*` 或特定 domain）

### Issue 3: 看到舊版本內容
**原因**: CloudFront 快取未清除

**解決方案**:
1. 執行 Invalidation: `/*`
2. 等待完成（1-2 分鐘）
3. 清除瀏覽器快取（Ctrl+Shift+R）

## Screenshots Location

所有截圖應放置在：
```
images/lab08/
├── 00-index-html-code.png          # index.html 原始碼（含 fetch 程式碼）
├── 01-browser-success.png          # 瀏覽器成功畫面（含 HTTPS 鎖頭、學號、CORS 測試成功）
├── 02-s3-block-public-access.png   # S3 Permissions 頁面（Block all public access = ON）
├── 03-s3-bucket-policy.png         # S3 Bucket Policy（含 CloudFront Service Principal）
├── 04-cloudfront-distribution.png  # CloudFront Distribution 設定
└── 05-cloudfront-oac.png           # CloudFront OAC 設定
```

## 成果展示

### 網站 URL
```
https://dpw6s93caiwi1.cloudfront.net
```

**部署完成時間**: 2025-12-30

### 功能驗證清單
- [x] HTTPS 連線（顯示鎖頭）
- [x] 學號正確顯示（411177013）
- [x] 圖片正常載入
- [x] CORS Fetch 測試成功
- [x] S3 完全私有化
- [x] CloudFront OAC 正常運作

## 清理資源

```bash
# 1. 刪除 S3 檔案
aws s3 rm s3://wsse-lab08-411177013 --recursive --region ap-northeast-1

# 2. 刪除 S3 Bucket
aws s3 rb s3://wsse-lab08-411177013 --region ap-northeast-1

# 3. 刪除 CloudFront Distribution
# 需在 Console 中先 Disable，等待完成後再 Delete

# 4. 刪除 OAC
# 在 CloudFront Console > Origin access > 刪除 wsse-lab08-oac
```

## Summary

Lab 08 成功實作了完整的靜態網站託管架構：

1. ✅ **安全性**: S3 完全私有化，只能透過 CloudFront + OAC 存取
2. ✅ **效能**: CloudFront 全球 CDN 加速
3. ✅ **可靠性**: HTTPS 加密傳輸
4. ✅ **相容性**: CORS 配置允許跨域請求

這個架構展示了 AWS 最佳實踐：私有化資料存儲、安全的內容分發、以及現代 Web 應用的安全性考量。
