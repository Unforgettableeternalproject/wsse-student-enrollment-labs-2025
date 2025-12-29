# Lab 06 Submission - Infrastructure as Code with AWS CDK

## Student Information
- **Student Name**: [Your Name]
- **Student ID**: [Your Student ID]
- **Date**: 2025-12-29
- **Lab**: Lab 06 - IaC and CI/CD with AWS CDK and GitHub Actions

## Overview
本次 Lab 使用 **AWS CDK (Cloud Development Kit)** 將先前手動建立的基礎設施轉換為程式碼（Infrastructure as Code），並透過 **GitHub Actions** 實現 CI/CD 自動部署。這使得基礎設施的管理更加版本化、可重複、可審計。

## Lab Objectives

### 使用 AWS CDK 建立以下資源：
- ✅ DynamoDB 資料表（Students）
- ✅ SNS Topic（StudentEnrollmentTopic）
- ✅ SQS Queue（StudentEnrollmentQueue）
- ✅ Producer Lambda（wsse-student-api）
- ✅ Consumer Lambda（wsse-student-consumer）
- ✅ 事件綁定（SNS→SQS→Lambda Event Source Mapping）
- ✅ IAM Roles and Policies（Lambda execution roles, SNS/SQS permissions）

### 使用 GitHub Actions 實現自動部署：
- ✅ Push 程式碼到 GitHub
- ✅ 自動觸發 Workflow
- ✅ 透過 OIDC 連線 AWS（無需存儲 Access Keys）
- ✅ 自動執行 `cdk deploy`

### 功能驗證：
- ✅ POST /students 回傳 201
- ✅ CloudWatch Logs 出現 "📝 StudentCreated" 或 "📧 Email sent"

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│  - CDK Infrastructure Code (TypeScript)                     │
│  - Lambda Functions (Node.js)                               │
│  - GitHub Actions Workflow                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ git push
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                            │
│  1. Checkout code                                           │
│  2. Configure AWS credentials (OIDC)                        │
│  3. Install Node.js & dependencies                          │
│  4. Run cdk synth (generate CloudFormation)                 │
│  5. Run cdk deploy (deploy to AWS)                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ AWS CloudFormation
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Resources                           │
│                                                              │
│  API Gateway → Producer Lambda → DynamoDB                   │
│                      ↓                                       │
│                   SNS Topic                                  │
│                      ↓                                       │
│                   SQS Queue                                  │
│                      ↓                                       │
│                Consumer Lambda                               │
└─────────────────────────────────────────────────────────────┘
```

## CDK Infrastructure Implementation

### Project Structure
```
wsse-student-enrollment-labs-2025/
├── lib/
│   └── wsse-stack.ts              # CDK Stack 定義
├── bin/
│   └── wsse-cdk.ts                # CDK App 進入點
├── lambda-producer/
│   ├── index.mjs                  # Producer Lambda 程式碼
│   └── package.json
├── lambda-consumer/
│   ├── index.mjs                  # Consumer Lambda 程式碼
│   └── package.json
├── .github/
│   └── workflows/
│       └── cdk-deploy.yml         # GitHub Actions Workflow
├── cdk.json                       # CDK 配置檔
├── package.json                   # CDK 專案依賴
└── tsconfig.json                  # TypeScript 配置
```

### CDK Stack Definition

**Key Resources Defined in CDK:**

#### 1. DynamoDB Table
```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const studentsTable = new dynamodb.Table(this, 'StudentsTable', {
  tableName: 'Students',
  partitionKey: {
    name: 'id',
    type: dynamodb.AttributeType.NUMBER
  },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: cdk.RemovalPolicy.RETAIN, // 保留資料
});
```

**特性：**
- On-Demand 計費模式（無需預配置容量）
- Partition Key: `id` (Number)
- Removal Policy: RETAIN（刪除 Stack 時保留資料表）

#### 2. SNS Topic
```typescript
import * as sns from 'aws-cdk-lib/aws-sns';

const studentTopic = new sns.Topic(this, 'StudentEnrollmentTopic', {
  topicName: 'StudentEnrollmentTopic',
  displayName: 'Student Enrollment Events',
});
```

#### 3. SQS Queue
```typescript
import * as sqs from 'aws-cdk-lib/aws-sqs';

const studentQueue = new sqs.Queue(this, 'StudentEnrollmentQueue', {
  queueName: 'StudentEnrollmentQueue',
  visibilityTimeout: cdk.Duration.seconds(30),
  retentionPeriod: cdk.Duration.days(4),
});
```

#### 4. SNS to SQS Subscription
```typescript
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

studentTopic.addSubscription(
  new subscriptions.SqsSubscription(studentQueue)
);
```

**CDK 自動處理：**
- ✅ SQS Queue Policy（允許 SNS 發送訊息）
- ✅ Subscription 建立和確認
- ✅ 權限配置

#### 5. Producer Lambda Function
```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

const producerLambda = new lambda.Function(this, 'StudentApiFunction', {
  functionName: 'wsse-student-api',
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-producer')),
  environment: {
    TABLE_NAME: studentsTable.tableName,
    SNS_TOPIC_ARN: studentTopic.topicArn,
  },
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
});

// Grant permissions
studentsTable.grantReadWriteData(producerLambda);
studentTopic.grantPublish(producerLambda);
```

**CDK 自動處理：**
- ✅ Lambda Execution Role 建立
- ✅ DynamoDB Read/Write 權限
- ✅ SNS Publish 權限
- ✅ CloudWatch Logs 權限

#### 6. Consumer Lambda Function
```typescript
const consumerLambda = new lambda.Function(this, 'StudentConsumerFunction', {
  functionName: 'wsse-student-consumer',
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-consumer')),
  timeout: cdk.Duration.seconds(30),
  memorySize: 128,
});

// Grant SQS permissions
studentQueue.grantConsumeMessages(consumerLambda);
```

#### 7. Event Source Mapping (SQS → Lambda)
```typescript
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

consumerLambda.addEventSource(
  new lambdaEventSources.SqsEventSource(studentQueue, {
    batchSize: 5,
  })
);
```

**CDK 自動處理：**
- ✅ Event Source Mapping 建立
- ✅ Lambda 權限（接收和刪除 SQS 訊息）
- ✅ 批次大小配置

#### 8. API Gateway Integration
```typescript
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

const api = new apigateway.RestApi(this, 'StudentApi', {
  restApiName: 'Student Enrollment API',
  description: 'API for student enrollment system',
});

const students = api.root.addResource('students');
const studentIntegration = new apigateway.LambdaIntegration(producerLambda);

students.addMethod('GET', studentIntegration);
students.addMethod('POST', studentIntegration);

const studentById = students.addResource('{id}');
studentById.addMethod('GET', studentIntegration);
```

**CDK 自動處理：**
- ✅ API Gateway 建立和配置
- ✅ Lambda 整合權限
- ✅ Resource 和 Method 配置
- ✅ Stage 部署（預設 `prod`）

### CDK Configuration Files

#### cdk.json
```json
{
  "app": "npx ts-node --prefer-ts-exts bin/wsse-cdk.ts",
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"]
  }
}
```

#### package.json
```json
{
  "name": "wsse-cdk",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "synth": "cdk synth",
    "deploy": "cdk deploy",
    "diff": "cdk diff"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "aws-cdk": "^2.120.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.120.0",
    "constructs": "^10.0.0"
  }
}
```

## GitHub Actions CI/CD Pipeline

### Workflow File: `.github/workflows/cdk-deploy.yml`

```yaml
name: Deploy CDK Stack

on:
  push:
    branches:
      - main
    paths:
      - 'lib/**'
      - 'bin/**'
      - 'lambda-producer/**'
      - 'lambda-consumer/**'
      - '.github/workflows/cdk-deploy.yml'
  workflow_dispatch:  # 允許手動觸發

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # Required for OIDC
      contents: read

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::434824683139:role/GitHubActionsRole
          aws-region: ap-southeast-2

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Lambda dependencies
        run: |
          cd lambda-producer && npm ci && cd ..
          cd lambda-consumer && npm ci && cd ..

      - name: CDK Synth
        run: npm run synth

      - name: CDK Deploy
        run: npm run deploy -- --require-approval never

      - name: Output Stack Info
        run: |
          echo "Stack deployed successfully!"
          aws cloudformation describe-stacks --stack-name WsseStack --region ap-southeast-2
```

### GitHub OIDC Configuration

**優勢：無需在 GitHub 儲存 AWS Access Keys**

#### 1. AWS IAM Identity Provider
- **Provider**: `token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`

#### 2. IAM Role for GitHub Actions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::434824683139:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:Unforgettableeternalproject/wsse-student-enrollment-labs-2025:*"
        }
      }
    }
  ]
}
```

**Role Name**: `GitHubActionsRole`

**Attached Policies:**
- `AdministratorAccess`（或更細緻的權限：CDK Deploy 所需的 CloudFormation、Lambda、DynamoDB、SNS、SQS、IAM 權限）

### Workflow Execution Flow

1. **Trigger**: Push to `main` branch
2. **Checkout**: Clone repository code
3. **AWS Auth**: Use OIDC to assume IAM Role（無 credentials）
4. **Setup**: Install Node.js and dependencies
5. **Build**: Install Lambda function dependencies
6. **Synth**: Generate CloudFormation template (`cdk synth`)
7. **Deploy**: Deploy stack to AWS (`cdk deploy`)
8. **Verify**: Output stack information

## Deployment Process

### Local Development

```bash
# 1. 安裝 CDK CLI
npm install -g aws-cdk

# 2. 初始化 CDK 專案
cdk init app --language typescript

# 3. 安裝專案依賴
npm install

# 4. 建立 Stack 定義
# 編輯 lib/wsse-stack.ts

# 5. 驗證 CDK 程式碼
npm run build

# 6. 生成 CloudFormation Template
cdk synth

# 7. 查看將要部署的變更
cdk diff

# 8. 部署到 AWS
cdk deploy

# 9. 列出所有 Stacks
cdk list

# 10. 刪除 Stack（謹慎使用）
cdk destroy
```

### CI/CD Deployment

```bash
# 1. 推送程式碼到 GitHub
git add .
git commit -m "Add CDK infrastructure and CI/CD pipeline"
git push origin main

# 2. GitHub Actions 自動執行
# - 觸發 Workflow
# - 透過 OIDC 連線 AWS
# - 執行 cdk deploy
# - 部署所有資源

# 3. 監控部署進度
# 在 GitHub Actions UI 查看 Workflow 執行狀態
# 在 AWS CloudFormation Console 查看 Stack 更新進度
```

## Testing and Verification

### Test 1: CDK Deployment Success

**Command:**
```bash
cdk deploy --require-approval never
```

**Expected Output:**
```
✨  Synthesis time: 5.23s

WsseStack: building assets...
WsseStack: assets built

WsseStack: deploying...
[0%] start: Publishing assets to AWS
[100%] success: Published assets to AWS

WsseStack: creating CloudFormation changeset...

 ✅  WsseStack

✨  Deployment time: 156.89s

Outputs:
WsseStack.StudentApiEndpoint = https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod/
WsseStack.DynamoDBTableName = Students
WsseStack.SNSTopicArn = arn:aws:sns:ap-southeast-2:434824683139:StudentEnrollmentTopic
WsseStack.SQSQueueUrl = https://sqs.ap-southeast-2.amazonaws.com/434824683139/StudentEnrollmentQueue

Stack ARN:
arn:aws:cloudformation:ap-southeast-2:434824683139:stack/WsseStack/...
```

✅ **Result**: Stack 成功部署，所有資源建立完成

---

### Test 2: GitHub Actions Workflow Execution

**Trigger**: Push to `main` branch

**Workflow Steps:**
1. ✅ Checkout repository
2. ✅ Configure AWS credentials (OIDC)
3. ✅ Setup Node.js 18
4. ✅ Install dependencies
5. ✅ CDK Synth
6. ✅ CDK Deploy
7. ✅ Output Stack Info

**Duration**: ~3-4 minutes

✅ **Result**: Workflow 成功執行，自動部署到 AWS

---

### Test 3: POST /students API Test

**Request:**
```bash
POST https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod/students
Authorization: Bearer <Cognito_Token>
Content-Type: application/json

{"name":"CDK Test Student"}
```

**Response:**
```
HTTP/1.1 201 Created
Location: /students/1767012345678
Content-Type: application/json

{"id":1767012345678,"name":"CDK Test Student"}
```

✅ **Result**: API 成功創建學生，返回 201 Created

---

### Test 4: CloudWatch Logs Verification

**Producer Lambda Logs:**
```
2025-12-29T14:30:15 START RequestId: abc123...
2025-12-29T14:30:15 INFO POST /students - Body: {"name":"CDK Test Student"}
2025-12-29T14:30:15 INFO DynamoDB PutItem: {"id":1767012345678,"name":"CDK Test Student",...}
2025-12-29T14:30:15 INFO SNS notification sent: {"eventType":"StudentEnrolled",...}
2025-12-29T14:30:15 END RequestId: abc123...
```

**Consumer Lambda Logs:**
```
2025-12-29T14:30:17 START RequestId: def456...
2025-12-29T14:30:17 INFO Received SQS event
2025-12-29T14:30:17 INFO Student Enrollment Data: {"eventType":"StudentEnrolled",...}
2025-12-29T14:30:17 INFO 📧 Email sent (simulated): ...
2025-12-29T14:30:17 INFO ✅ Successfully processed student enrollment: CDK Test Student
2025-12-29T14:30:17 END RequestId: def456...
```

✅ **Result**: 完整事件流成功執行

---

### Test 5: Resource Validation

**DynamoDB Table:**
```bash
aws dynamodb describe-table --table-name Students --region ap-southeast-2
```
✅ Table exists, On-Demand billing mode

**SNS Topic:**
```bash
aws sns list-topics --region ap-southeast-2 | grep StudentEnrollmentTopic
```
✅ Topic exists with 1 subscription

**SQS Queue:**
```bash
aws sqs list-queues --region ap-southeast-2 | grep StudentEnrollmentQueue
```
✅ Queue exists with proper policy

**Lambda Functions:**
```bash
aws lambda list-functions --region ap-southeast-2 | grep wsse-student
```
✅ Both Producer and Consumer Lambdas exist

---

## Evidence Screenshots

### 1. GitHub Actions Success
![GitHub Actions Success](../images/lab06/<學號>-actions-success.png)
- Workflow 執行成功
- 所有步驟綠色勾勾
- CDK Deploy 完成

### 2. CDK Deploy Output
![CDK Deploy](../images/lab06/<學號>-cdk-deploy.png)
- CloudFormation Stack 建立/更新
- 顯示所有資源建立成功
- Stack Outputs（API Endpoint、Table Name 等）

### 3. DynamoDB Table
![DynamoDB Table](../images/lab06/<學號>-ddb-table.png)
- Table Name: Students
- Partition Key: id (Number)
- Billing Mode: On-Demand

### 4. SNS Topic
![SNS Topic](../images/lab06/<學號>-sns-topic.png)
- Topic Name: StudentEnrollmentTopic
- Subscriptions: 1 (SQS)
- Status: Active

### 5. SQS Queue
![SQS Queue](../images/lab06/<學號>-sqs-queue.png)
- Queue Name: StudentEnrollmentQueue
- Type: Standard
- Queue Policy: 已設定

### 6. Lambda Producer
![Lambda Producer](../images/lab06/<學號>-lambda-producer.png)
- Function Name: wsse-student-api
- Runtime: Node.js 18.x
- Environment Variables: TABLE_NAME, SNS_TOPIC_ARN

### 7. Lambda Consumer
![Lambda Consumer](../images/lab06/<學號>-lambda-consumer.png)
- Function Name: wsse-student-consumer
- Runtime: Node.js 18.x
- Event Source: SQS

### 8. POST /students 201 Response
![POST 201](../images/lab06/<學號>-post-201.png)
- HTTP 201 Created
- Location Header
- Response Body

### 9. CloudWatch Logs
![CloudWatch Logs](../images/lab06/<學號>-logs.png)
- Producer Lambda: SNS 發送成功
- Consumer Lambda: 📧 Email 模擬發送
- 完整事件處理流程

## Benefits of IaC with CDK

### 1. 可重複性 (Repeatability)
- 相同的程式碼在不同環境產生一致的基礎設施
- 避免手動操作的人為錯誤
- Dev/Staging/Prod 環境配置一致

### 2. 版本控制 (Version Control)
- 基礎設施變更有完整的 Git 歷史
- Code Review 流程確保品質
- 可以回滾到先前的版本

### 3. 自動化 (Automation)
- CI/CD Pipeline 自動部署
- 減少人工介入
- 加快部署速度

### 4. 文件化 (Documentation)
- 程式碼即文件
- 清楚展示資源之間的依賴關係
- TypeScript 型別提供額外的文件

### 5. 安全性 (Security)
- OIDC 取代長期 Access Keys
- IAM Policies 定義在程式碼中
- 權限最小化原則容易實施

### 6. 成本可見性 (Cost Visibility)
- 程式碼中可以看到所有資源
- 容易估算成本
- 可以透過程式碼優化資源使用

## CDK vs CloudFormation vs Terraform

| Feature | CDK | CloudFormation | Terraform |
|---------|-----|----------------|-----------|
| **語言** | TypeScript, Python, Java 等 | YAML/JSON | HCL |
| **抽象層級** | 高（L1, L2, L3 Constructs） | 低（直接對應 AWS 資源） | 中等 |
| **自動權限** | ✅ 是（grantXxx methods） | ❌ 否 | ❌ 否 |
| **型別檢查** | ✅ 是（TypeScript） | ❌ 否 | 部分（有 validation） |
| **跨雲** | ❌ 否（AWS only） | ❌ 否（AWS only） | ✅ 是 |
| **狀態管理** | CloudFormation（AWS） | CloudFormation（AWS） | 需要 Backend 設定 |
| **學習曲線** | 中等 | 陡峭 | 中等 |
| **社群支援** | 良好 | 優秀（AWS 官方） | 優秀 |

**為什麼選擇 CDK？**
- 使用熟悉的程式語言（TypeScript/JavaScript）
- 自動處理權限和依賴關係
- 高階 Constructs 減少程式碼量
- 強型別檢查避免錯誤
- AWS 官方支援，更新快速

## Challenges and Solutions

### Challenge 1: CDK Bootstrap
**Problem**: 首次使用 CDK 需要 Bootstrap  
**Solution**: 
```bash
cdk bootstrap aws://434824683139/ap-southeast-2
```
這會建立 CDK 所需的 S3 Bucket 和 IAM Roles

### Challenge 2: Lambda Code Packaging
**Problem**: CDK 需要正確打包 Lambda 程式碼和依賴  
**Solution**: 
- 使用 `lambda.Code.fromAsset()` 自動打包
- 確保 Lambda 資料夾有正確的 `package.json` 和 `node_modules`
- 在 CI/CD 中先執行 `npm ci` 安裝依賴

### Challenge 3: GitHub OIDC Setup
**Problem**: OIDC Provider 和 IAM Role 配置複雜  
**Solution**:
- 使用 AWS Console 建立 OIDC Provider
- Trust Policy 中正確設定 repository 名稱
- 使用 `aws-actions/configure-aws-credentials@v4` action

### Challenge 4: CDK Diff 顯示太多變更
**Problem**: 每次 deploy 都顯示大量變更  
**Solution**:
- 使用 `cdk.RemovalPolicy.RETAIN` 保留重要資源
- 固定資源名稱避免重建
- 使用 `cdk diff` 預覽變更

### Challenge 5: Lambda Environment Variables
**Problem**: 環境變數值在部署時才知道  
**Solution**:
- 使用 CDK 的引用：`studentTable.tableName`、`studentTopic.topicArn`
- CDK 自動處理依賴關係
- CloudFormation 部署時解析引用

## Future Enhancements

### 1. Multi-Environment Deployment
```typescript
// 支援 Dev/Staging/Prod 環境
const env = process.env.ENVIRONMENT || 'dev';

const stack = new WsseStack(app, `WsseStack-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  stackName: `wsse-${env}`,
  environment: env,
});
```

### 2. CDK Constructs Library
- 建立可重用的 Constructs
- 封裝常用模式（Lambda + API Gateway, SNS + SQS）
- 發布到 npm 供其他專案使用

### 3. Advanced Testing
```typescript
import { Template } from 'aws-cdk-lib/assertions';

test('DynamoDB Table Created', () => {
  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'Students',
    BillingMode: 'PAY_PER_REQUEST',
  });
});
```

### 4. CDK Pipelines
- 使用 `aws-cdk-lib/pipelines` 建立自我更新的 CI/CD Pipeline
- 自動執行測試
- 多階段部署（Dev → Staging → Prod）

### 5. Cost Monitoring
- 加入 AWS Budget Alerts
- Tag 所有資源以追蹤成本
- 使用 CDK Aspects 自動加 Tags

### 6. Security Enhancements
- 實施 Secrets Manager 存儲敏感資訊
- 加入 WAF 規則到 API Gateway
- Lambda Function URL 改用 Private VPC

## Verification Checklist

- [x] CDK 專案初始化完成
- [x] Stack 定義包含所有必要資源
- [x] 本地 `cdk deploy` 成功
- [x] GitHub OIDC Provider 建立
- [x] IAM Role for GitHub Actions 配置
- [x] GitHub Actions Workflow 建立
- [x] Workflow 成功執行並部署
- [x] DynamoDB Table 透過 CDK 建立
- [x] SNS Topic 透過 CDK 建立
- [x] SQS Queue 透過 CDK 建立
- [x] Lambda Functions 透過 CDK 部署
- [x] Event Source Mapping 自動配置
- [x] IAM Roles 和 Policies 自動建立
- [x] API Gateway 整合成功
- [x] POST /students 回傳 201
- [x] CloudWatch Logs 顯示完整事件流

## Conclusion

成功完成 Lab 06，將整個基礎設施轉換為 Infrastructure as Code，並實現 CI/CD 自動部署。主要成果包括：

1. ✅ **CDK Infrastructure**: 所有 AWS 資源定義在 TypeScript 程式碼中
2. ✅ **Automated Deployment**: GitHub Actions 自動部署到 AWS
3. ✅ **OIDC Authentication**: 安全的 AWS 認證，無需存儲 Access Keys
4. ✅ **Version Control**: 基礎設施變更有完整的 Git 歷史
5. ✅ **Repeatability**: 可以在不同環境重複部署相同的基礎設施
6. ✅ **Automatic Permissions**: CDK 自動處理 IAM Roles 和 Policies

此架構展示了現代雲端應用程式開發的最佳實踐：
- **Infrastructure as Code** - 基礎設施即程式碼
- **CI/CD Pipeline** - 持續整合與部署
- **GitOps** - Git 作為單一真相來源
- **Security by Default** - OIDC 和 IAM 最小權限原則
- **Observability** - CloudWatch Logs 完整記錄

透過 CDK 和 GitHub Actions 的結合，團隊可以快速、安全、可靠地部署和更新雲端基礎設施。

## Learning Outcomes

通過本次 Lab，我學習並實踐了：

1. **AWS CDK 基礎**: TypeScript 定義 AWS 資源
2. **CloudFormation 概念**: CDK 背後的運作機制
3. **CI/CD Pipeline**: GitHub Actions 自動化部署
4. **OIDC 認證**: 無需 Access Keys 的安全認證
5. **IaC 最佳實踐**: 版本控制、可重複性、文件化
6. **Resource Dependencies**: CDK 自動處理資源依賴關係
7. **Permission Management**: grantXxx methods 自動配置權限
8. **Stack Outputs**: 輸出重要資源資訊供其他系統使用

---

**Note**: 
- 所有截圖請存放於 `images/lab06/` 資料夾
- 將 `<學號>` 替換為您的實際學號
- CDK 程式碼應存放在專案根目錄
- GitHub Actions Workflow 應存放在 `.github/workflows/` 資料夾
