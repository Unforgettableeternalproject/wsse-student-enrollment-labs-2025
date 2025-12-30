[![English](https://img.shields.io/badge/English-README-blue)](README.md)

# WSSE 學生註冊系統

## 概述

WSSE 學生註冊系統是一個為網際服務軟體工程課程開發的全端伺服器應用程式。這是一個學習專案，使用 OpenAPI 規格來建構學生註冊系統，具有強大的安全性和授權功能。它作為現代網路服務開發的綜合範例，包含 RESTful API、認證和授權機制。

## 功能

* **OpenAPI 規格**：使用 OpenAPI 3.0 為學生註冊操作提供完整的 API 文件
* **身份驗證與授權**：AWS Cognito 整合 OAuth2 進行安全的使用者管理
* **無伺服器架構**：AWS Lambda 函數提供可擴展的 API 端點
* **NoSQL 資料庫**：DynamoDB 提供高效能的學生資料持久化
* **事件驅動處理**：SNS & SQS 整合實現非同步工作流程
* **基礎設施即程式碼**：AWS CDK 自動化基礎設施部署
* **可觀測性**：CloudWatch Logs、Metrics、Alarms、Dashboard 及 X-Ray 分散式追蹤
* **CDN 與靜態託管**：CloudFront + S3 全球內容分發
* **CI/CD 管道**：GitHub Actions 搭配 OIDC 身份驗證自動化部署
* **API 文件**：互動式 Swagger UI 提供 API 探索和測試

## 截圖

每個實驗的實作截圖可在 `images/` 目錄中找到：
- Lab 01: OpenAPI 規格 (`images/lab01/`)
- Lab 02: Cognito 身份驗證 (`images/lab02/`)
- Lab 03-05: Lambda、DynamoDB、SNS/SQS 整合
- Lab 06: CDK 基礎設施 (`images/lab06/`)
- Lab 07: CloudWatch 可觀測性 (`images/lab07/`)
- Lab 08: CloudFront 前端託管 (`images/lab08/`)

## 架構

本專案在 AWS 上實作了現代無伺服器架構：

```
使用者 → CloudFront → API Gateway → Lambda (Producer) → DynamoDB
                                           ↓
                                       SNS Topic
                                           ↓
                                       SQS Queue
                                           ↓
                                   Lambda (Consumer)
```

**核心元件**：
- **前端**：S3 + CloudFront 靜態網站託管
- **API 層**：API Gateway + Lambda 函數 (Node.js 18.x)
- **資料儲存**：DynamoDB (Students 資料表)
- **事件處理**：SNS/SQS 非同步學生註冊事件
- **監控**：CloudWatch + X-Ray 可觀測性
- **基礎設施**：AWS CDK (TypeScript) 基礎設施即程式碼

## 部署

### 前置需求
- 具有適當權限的 AWS 帳號
- 已設定 AWS CLI
- Node.js 18.x 或更新版本
- AWS CDK CLI (`npm install -g aws-cdk`)

### 透過 CDK 部署

1. **複製儲存庫**：
   ```bash
   git clone https://github.com/unforgettableeternalproject/wsse-student-enrollment-labs-2025
   cd wsse-student-enrollment-labs-2025
   ```

2. **安裝 CDK 依賴**：
   ```bash
   npm install
   ```

3. **部署基礎設施**：
   ```bash
   cdk deploy
   ```

### 透過 GitHub Actions 部署

- 推送到 `main` 分支觸發自動部署
- 使用 OIDC 進行安全的 AWS 身份驗證
- 自動部署 CDK 堆疊變更

## 使用

### 認證

詳細的 API 文件請參閱 `openapi/openapi.yaml` 或造訪 Swagger UI

## API 端點

### 學生管理

```
GET    /students           - 列出所有學生
POST   /students           - 建立新學生
GET    /students/{id}      - 依 ID 取得學生
PUT    /students/{id}      - 更新學生
DELETE /students/{id}      - 刪除學生
本專案隨課程進展完成了以下實驗：

- **Lab 1** ✅：OpenAPI 規格 - 使用 OpenAPI 3.0 定義 RESTful API 規格及 Swagger 驗證
- **Lab 2** ✅：AWS Cognito - OAuth2 身份驗證與使用者池整合
- **Lab 3** ✅：Lambda 函數 - 無伺服器 API 端點實作
- **Lab 4** ✅：DynamoDB - NoSQL 資料庫整合學生資料持久化
- **Lab 5** ✅：SNS/SQS - 事件驅動架構實作非同步訊息處理
- **Lab 6** ✅：AWS CDK - 基礎設施即程式碼自動化部署
- **Lab 7** ✅：可觀測性 - CloudWatch Logs、Metrics、Alarms、Dashboard 及 X-Ray 追蹤
- **Lab 8** ✅：前端託管 - CloudFront CDN + S3 靜態網站託管
### 身份驗證

身份驗證透過 AWS Cognito 處理：
1. 從 Cognito User Pool 取得存取權杖
2. 在 `Authorization` 標頭中包含權杖：`Bearer <token>`
3. 權杖由 API Gateway 授權器驗證

## 專案結構

```
wsse-student-enrollment-labs-2025/
├── openapi/
│   └── openapi.yaml                 # OpenAPI 3.0 規格
├── lambda-producer/
│   └── index.mjs                    # Producer Lambda (API 處理器)
├── lambda-consumer/
│   └── index.mjs                    # Consumer Lambda (事件處理器)
├── lib/
│   └── wsse-stack.ts                # CDK Stack 定義
├── bin/
│   └── wsse-cdk.ts                  # CDK app 進入點
├── frontend/
│   ├── index.html                   # 靜態網站
│   └── image.jpg                    # 示範圖片
├── .github/
│   └── workflows/
│       ├── openapi-validation.yml   # OpenAPI 規格驗證
│       └── cdk-deploy.yml           # CDK 部署工作流程
├── submissions/                      # Lab 提交文件
│   ├── lab01-submission.md
│   ├── lab02-submission.md
│   ├── lab06-submission.md
│   ├── lab07-submission.md
│   └── lab08-submission.md
└── images/                          # Lab 截圖
    ├── lab01/, lab02/, lab03/
    ├── lab06/, lab07/, lab08/
    └── ...
```

## 監控與可觀測性

系統包含完整的可觀測性功能：

- **CloudWatch Logs**：Lambda 執行日誌保留 7 天
- **CloudWatch Metrics**：API 呼叫、錯誤、延遲的自訂指標
- **CloudWatch Alarms**：監控系統健康的 4 個警報
  - Producer Lambda 錯誤 (5 分鐘內 ≥3 次)
  - Producer Lambda 執行時間 (>5000ms)
  - Consumer Lambda 錯誤 (5 分鐘內 ≥3 次)
  - DynamoDB 節流 (5 分鐘內 ≥5 次)
- **CloudWatch Dashboard**：系統指標的即時視覺化
- **X-Ray 追蹤**：請求流程的分散式追蹤

 - 待辦

### 學生註冊

 - 待辦

### API 文件

在 `/api-docs` 存取互動式 API 文件，以探索所有可用端點、測試請求和查看回應結構。

## Lab 進度

這個專案將隨著課程進展而演變，每堂課都會添加新功能：

- **Lab 1**：基本 OpenAPI 規格
- **Lab 2**：待探索
- **Lab 3**：待探索
- **Lab 4**：待探索
- **Lab 5**：待探索
- **Lab 6**：待探索

## 待辦事項

- [ ] 實現 OAuth2 整合以進行第三方認證
- [ ] 添加速率限制和 API 節流
- [ ] 實現全面的單元和整合測試
- [ ] 添加 API 版本支援
- [ ] 實現快取層以提升效能
- [ ] 添加註冊更新的即時通知
- [ ] 增強錯誤處理和驗證
- [ ] 添加 API 分析和監控儀表板

## 貢獻

這是一個課程專案，僅供學習用途。歡迎為教育增進做出貢獻。請遵循課程指南並提交拉取請求以供審核。

## 授權

這個專案僅供網際服務軟體工程課程的教育用途。

## 聯絡

有關此課程專案的問題或建議，請聯絡課程講師或助教。

[![Static Badge](https://img.shields.io/badge/course-WSSE-blue)](mailto:course@example.com)