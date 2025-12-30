# Lab 08 - 前端託管實戰

## 目標

建立一個完整的靜態網站託管架構，使用：
- **Private S3 Bucket** (Block all public access)
- **CloudFront Distribution** (CDN + HTTPS)
- **Origin Access Control (OAC)** (安全存取 S3)
- **CORS 配置** (跨域資源共享)

## 實作步驟

### 1. 建立 S3 Bucket

```bash
# 設定學號變數
$STUDENT_ID = "YOUR_STUDENT_ID"  # 替換成你的學號
$BUCKET_NAME = "wsse-lab08-$STUDENT_ID"

# 建立 Bucket
aws s3 mb s3://$BUCKET_NAME --region ap-northeast-1

# 啟用 Block all public access (預設已啟用，確保一下)
aws s3api put-public-access-block `
    --bucket $BUCKET_NAME `
    --public-access-block-configuration `
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 2. 準備檔案

```bash
# 下載或準備一張圖片，命名為 image.jpg
# 可以使用任何 jpg 圖片，放在 frontend/ 目錄下
```

### 3. 上傳初始檔案

```bash
# 上傳 index.html 和圖片
cd frontend
aws s3 cp index.html s3://$BUCKET_NAME/ --region ap-northeast-1
aws s3 cp image.jpg s3://$BUCKET_NAME/ --region ap-northeast-1
```

### 4. 建立 CloudFront Distribution

#### 4.1 建立 Origin Access Control (OAC)

1. 前往 AWS Console > CloudFront
2. 點擊左側選單 "Origin access" > "Origin access control"
3. 點擊 "Create control setting"
4. 設定：
   - **Name**: `wsse-lab08-oac`
   - **Description**: `OAC for Lab 08 S3 bucket`
   - **Signing behavior**: `Sign requests (recommended)`
   - **Origin type**: `S3`
5. 點擊 "Create"

#### 4.2 建立 Distribution

1. 前往 CloudFront > Distributions
2. 點擊 "Create distribution"
3. 設定：
   - **Origin domain**: 選擇你的 S3 bucket (wsse-lab08-STUDENT_ID.s3.ap-northeast-1.amazonaws.com)
   - **Origin access**: 選擇 "Origin access control settings (recommended)"
   - **Origin access control**: 選擇剛才建立的 OAC
   - **Viewer protocol policy**: `Redirect HTTP to HTTPS`
   - **Allowed HTTP methods**: `GET, HEAD`
   - **Cache policy**: `CachingOptimized`
   - **Default root object**: `index.html`
4. 點擊 "Create distribution"
5. **重要**: 複製 CloudFront 提供的 S3 Bucket Policy（會顯示在建立後的通知中）

### 5. 設定 S3 Bucket Policy

將 CloudFront 提供的 Policy 貼到 S3 Bucket Policy：

1. 前往 S3 Console > 你的 bucket > Permissions
2. 找到 "Bucket policy" 區塊
3. 點擊 "Edit"
4. 貼上 CloudFront 提供的 Policy JSON（類似下方格式）：

```json
{
    "Version": "2012-10-17",
    "Statement": {
        "Sid": "AllowCloudFrontServicePrincipalReadOnly",
        "Effect": "Allow",
        "Principal": {
            "Service": "cloudfront.amazonaws.com"
        },
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::BUCKET_NAME/*",
        "Condition": {
            "StringEquals": {
                "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
            }
        }
    }
}
```

5. 點擊 "Save changes"

### 6. 設定 S3 CORS

1. 在 S3 Console > 你的 bucket > Permissions
2. 找到 "Cross-origin resource sharing (CORS)" 區塊
3. 點擊 "Edit"
4. 貼上 `s3-cors-config.json` 的內容
5. 點擊 "Save changes"

或使用 CLI：

```bash
aws s3api put-bucket-cors `
    --bucket $BUCKET_NAME `
    --cors-configuration file://s3-cors-config.json `
    --region ap-northeast-1
```

### 7. 更新 index.html

取得 CloudFront Domain Name（例如：`d1234567890abc.cloudfront.net`），然後：

1. 編輯 `index.html`
2. 找到 `testFetch()` 函數中的 `imageUrl` 變數
3. 將其改為完整的 CloudFront URL：
   ```javascript
   const imageUrl = 'https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net/image.jpg';
   ```
4. 在 `<div class="student-id">` 中填入你的學號

### 8. 重新上傳並清除快取

```bash
# 上傳更新後的 index.html
aws s3 cp index.html s3://$BUCKET_NAME/ --region ap-northeast-1

# 執行 CloudFront Invalidation
$DISTRIBUTION_ID = "YOUR_DISTRIBUTION_ID"  # 從 CloudFront console 取得
aws cloudfront create-invalidation `
    --distribution-id $DISTRIBUTION_ID `
    --paths "/*"
```

### 9. 驗證

1. 用瀏覽器開啟 CloudFront URL：`https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net`
2. 檢查：
   - ✅ 網址列顯示 HTTPS 鎖頭
   - ✅ 圖片正常顯示
   - ✅ 學號正確顯示
   - ✅ CORS Fetch 測試顯示成功
   - ✅ 系統資訊正確

3. 驗證 S3 私有化：
   - 嘗試直接存取 S3 URL：`https://BUCKET_NAME.s3.ap-northeast-1.amazonaws.com/index.html`
   - 應該會得到 403 Access Denied（證明 S3 是私有的）

## 繳交項目

請準備以下截圖並合併為一份 PDF：

### 1. 原始碼
- `index.html` 完整內容（包含 fetch 程式碼）

### 2. 截圖 A：瀏覽器成功畫面
- 網址列顯示 CloudFront Domain 與 HTTPS 鎖頭
- 畫面內容有你的學號
- CORS Fetch 測試顯示成功

### 3. 截圖 B：S3 權限設定
- S3 Console > Permissions 分頁
- 證明 "Block all public access" 為 On

### 4. 截圖 C：S3 Bucket Policy
- 證明 Policy 中包含 CloudFront 的 Service Principal 或 OAC ARN

## 故障排除

### 問題 1: 圖片無法顯示
- 檢查圖片是否已上傳到 S3
- 確認 S3 Bucket Policy 包含 CloudFront 的權限
- 執行 CloudFront Invalidation

### 問題 2: CORS Fetch 失敗
- 確認 S3 CORS 配置已正確設定
- 確認 `index.html` 中的 fetch URL 已更新
- 檢查瀏覽器 Console 的錯誤訊息

### 問題 3: 403 Access Denied
- 確認 CloudFront Distribution 狀態為 "Deployed"
- 檢查 S3 Bucket Policy 是否正確
- 確認 OAC 已正確設定

### 問題 4: 看到舊版本的 index.html
- 執行 CloudFront Invalidation：`/*`
- 等待 Invalidation 完成（通常 1-2 分鐘）
- 清除瀏覽器快取（Ctrl+Shift+R）

## 清理資源

```bash
# 刪除 S3 檔案
aws s3 rm s3://$BUCKET_NAME --recursive --region ap-northeast-1

# 刪除 S3 Bucket
aws s3 rb s3://$BUCKET_NAME --region ap-northeast-1

# CloudFront Distribution 需要手動在 Console 中 Disable 後再 Delete
```

## 重點提醒

⚠️ **Block Public Access 絕對不能關閉**  
我們要挑戰的是在全封鎖的情況下，打通 CloudFront 的連線。

⚠️ **S3 Policy 是 CloudFront 給你的**  
複製 CloudFront 建立 Distribution 後提供的 Policy JSON。

⚠️ **CORS 是你要自己寫的**  
允許 GET/HEAD 方法，設定允許的來源（可用 `*` 或特定 domain）。

⚠️ **修改 HTML 後一定要重新上傳**  
並且執行 Invalidation，否則會一直看到舊的快取畫面。
