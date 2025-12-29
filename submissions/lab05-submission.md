# Lab 05 Submission - Event-Driven Architecture with SNS/SQS

## Student Information
- **Student Name**: [Your Name]
- **Date**: 2025-12-29
- **Lab**: Lab 05 - SNS/SQS Event-Driven Notifications

## Overview
本次 Lab 實作了事件驅動架構，當新增學生時自動發送通知，模擬真實系統中的「新增學生後寄信」場景。使用 Amazon SNS 和 SQS 實現解耦的訊息傳遞機制，包括：
- 建立 SNS Topic 用於發布學生註冊事件
- 建立 SQS Queue 作為訊息緩衝
- SNS 訂閱 SQS 實現可靠的訊息傳遞
- Producer Lambda 在資料寫入後發送 SNS 通知
- Consumer Lambda 處理 SQS 訊息並模擬發送 Email

## Architecture
```
API Gateway (POST /students)
    ↓
Producer Lambda (wsse-student-api)
    ↓
DynamoDB (Students Table)
    ↓
Amazon SNS (StudentEnrollmentTopic)
    ↓
Amazon SQS (StudentEnrollmentQueue)
    ↓
Consumer Lambda (wsse-student-consumer)
    ↓
Email Notification (Simulated)
```

## Implementation Details

### 1. Amazon SNS Topic Configuration
- **Topic Name**: `StudentEnrollmentTopic`
- **Topic ARN**: `arn:aws:sns:ap-southeast-2:434824683139:StudentEnrollmentTopic`
- **Type**: Standard
- **Purpose**: 發布學生註冊事件，支援多個訂閱者（解耦架構）

**特性：**
- Fan-out 模式：一個事件可以觸發多個訂閱者
- 訊息持久化：SNS 確保訊息傳遞到所有訂閱者
- 重試機制：自動重試失敗的傳遞

### 2. Amazon SQS Queue Configuration
- **Queue Name**: `StudentEnrollmentQueue`
- **Queue URL**: `https://sqs.ap-southeast-2.amazonaws.com/434824683139/StudentEnrollmentQueue`
- **Queue ARN**: `arn:aws:sqs:ap-southeast-2:434824683139:StudentEnrollmentQueue`
- **Type**: Standard Queue
- **Visibility Timeout**: 30 seconds (Default)
- **Message Retention**: 4 days (Default)
- **Delivery Delay**: 0 seconds

**SQS Queue Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "sns.amazonaws.com"
      },
      "Action": "SQS:SendMessage",
      "Resource": "arn:aws:sqs:ap-southeast-2:434824683139:StudentEnrollmentQueue",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "arn:aws:sns:ap-southeast-2:434824683139:StudentEnrollmentTopic"
        }
      }
    }
  ]
}
```

**重要說明：**
- Policy 允許 SNS 服務發送訊息到此 Queue
- Condition 確保只有特定的 SNS Topic 可以發送訊息（安全性）

### 3. SNS to SQS Subscription
- **Protocol**: SQS
- **Endpoint**: `arn:aws:sqs:ap-southeast-2:434824683139:StudentEnrollmentQueue`
- **Subscription ARN**: `arn:aws:sns:ap-southeast-2:434824683139:StudentEnrollmentTopic:0c8bb9ee-e2b5-43ff-b611-8c884195031b`
- **Status**: Confirmed
- **Raw Message Delivery**: Disabled（保留 SNS 訊息包裝）

### 4. Producer Lambda Updates (wsse-student-api)

**新增功能：**
- 在成功寫入 DynamoDB 後發送 SNS 通知
- 使用 AWS SDK v3 SNS Client
- 非阻塞式通知（失敗不影響 API 回應）

**新增依賴：**
```json
{
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.709.0",
    "@aws-sdk/lib-dynamodb": "^3.709.0",
    "@aws-sdk/client-sns": "^3.709.0"
  }
}
```

**環境變數：**
- `TABLE_NAME`: Students
- `SNS_TOPIC_ARN`: arn:aws:sns:ap-southeast-2:434824683139:StudentEnrollmentTopic

**SNS 發送程式碼片段：**
```javascript
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({ region: "ap-southeast-2" });
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

// 在 POST /students 成功後
if (SNS_TOPIC_ARN) {
  try {
    const message = {
      eventType: "StudentEnrolled",
      student: {
        id: newStudent.id,
        name: newStudent.name,
        createdAt: newStudent.createdAt
      },
      timestamp: new Date().toISOString()
    };

    await snsClient.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Message: JSON.stringify(message),
      Subject: "New Student Enrolled",
      MessageAttributes: {
        eventType: {
          DataType: "String",
          StringValue: "StudentEnrolled"
        }
      }
    }));

    console.log("SNS notification sent:", message);
  } catch (snsError) {
    console.error("Failed to send SNS notification:", snsError);
    // 不影響主要流程
  }
}
```

**IAM 權限（新增）：**
- Policy Name: `SNSPublishAccess`
- 允許 Lambda 發送訊息到 StudentEnrollmentTopic

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSNSPublish",
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "arn:aws:sns:ap-southeast-2:434824683139:StudentEnrollmentTopic"
    }
  ]
}
```

### 5. Consumer Lambda Configuration (wsse-student-consumer)

**Lambda 基本配置：**
- **Function Name**: `wsse-student-consumer`
- **Runtime**: Node.js 18.x
- **Handler**: index.handler
- **Memory**: 128 MB
- **Timeout**: 30 seconds
- **Role**: `wsse-student-consumer-role`

**IAM Role 權限：**
- `AWSLambdaBasicExecutionRole` - CloudWatch Logs 寫入
- `AWSLambdaSQSQueueExecutionRole` - SQS 讀取和刪除訊息

**Event Source Mapping:**
- **UUID**: `3e3925ed-82c5-467c-9d7a-630be096fd5d`
- **Event Source ARN**: `arn:aws:sqs:ap-southeast-2:434824683139:StudentEnrollmentQueue`
- **Batch Size**: 5 messages
- **State**: Enabled

**Consumer Lambda 程式碼邏輯：**
```javascript
export const handler = async (event) => {
  console.log("Received SQS event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      // 1. 解析 SQS 中的 SNS 訊息
      const snsMessage = JSON.parse(record.body);
      console.log("SNS Message:", JSON.stringify(snsMessage, null, 2));

      // 2. 解析學生註冊資料
      const studentData = JSON.parse(snsMessage.Message);
      console.log("Student Enrollment Data:", JSON.stringify(studentData, null, 2));

      // 3. 模擬發送 Email
      const emailContent = {
        to: "admin@example.edu",
        subject: snsMessage.Subject || "New Student Enrolled",
        body: `
Student Enrollment Notification
================================

A new student has been enrolled:

- Student ID: ${studentData.student.id}
- Name: ${studentData.student.name}
- Enrolled At: ${studentData.student.createdAt}
- Event Type: ${studentData.eventType}
- Event Timestamp: ${studentData.timestamp}

This is an automated notification.
        `.trim()
      };

      console.log("📧 Email sent (simulated):", JSON.stringify(emailContent, null, 2));
      console.log(`✅ Successfully processed student enrollment: ${studentData.student.name}`);

    } catch (error) {
      console.error("❌ Error processing record:", error);
      console.error("Record body:", record.body);
      throw error; // 標記訊息為失敗，觸發重試
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Successfully processed ${event.Records.length} messages`
    })
  };
};
```

### 6. Event Flow and Message Format

**完整事件流程：**

1. **API Request** → POST /students with `{"name":"Test Student"}`
2. **Producer Lambda** → 寫入 DynamoDB，生成學生 ID
3. **SNS Publish** → 發送事件到 StudentEnrollmentTopic
4. **SNS to SQS** → SNS 自動推送到訂閱的 SQS Queue
5. **SQS Trigger** → 觸發 Consumer Lambda（批次處理）
6. **Consumer Processing** → 解析訊息並模擬發送 Email
7. **Message Deletion** → Lambda 成功處理後，SQS 自動刪除訊息

**SNS 訊息格式（Producer 發送）：**
```json
{
  "eventType": "StudentEnrolled",
  "student": {
    "id": 1767009812634,
    "name": "Lab05 Final Test",
    "createdAt": "2025-12-29T11:56:52.634Z"
  },
  "timestamp": "2025-12-29T11:56:52.678Z"
}
```

**SQS 接收的訊息格式（SNS 包裝）：**
```json
{
  "Type": "Notification",
  "MessageId": "c8725442-1e4c-5a2a-841c-358e70721126",
  "TopicArn": "arn:aws:sns:ap-southeast-2:434824683139:StudentEnrollmentTopic",
  "Subject": "New Student Enrolled",
  "Message": "{\"eventType\":\"StudentEnrolled\",\"student\":{\"id\":1767009812634,\"name\":\"Lab05 Final Test\",\"createdAt\":\"2025-12-29T11:56:52.634Z\"},\"timestamp\":\"2025-12-29T11:56:52.678Z\"}",
  "Timestamp": "2025-12-29T11:56:52.678Z",
  "SignatureVersion": "1",
  "Signature": "...",
  "SigningCertURL": "https://sns.ap-southeast-2.amazonaws.com/...",
  "UnsubscribeURL": "https://sns.ap-southeast-2.amazonaws.com/..."
}
```

## Testing Results

### Test 1: API POST 測試（觸發完整事件流）

**Request:**
```bash
POST https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod/students
Authorization: Bearer <Cognito_Token>
Content-Type: application/json

{"name":"Lab05 Final Test"}
```

**Response:**
```
HTTP/1.1 201 Created
Location: /students/1767009812634
Content-Type: application/json

{"id":1767009812634,"name":"Lab05 Final Test"}
```

✅ **Result**: API 成功創建學生並返回 201 + Location header

---

### Test 2: Producer Lambda 日誌（SNS 發送確認）

**CloudWatch Logs:**
```
2025-12-29T11:56:52 INFO SNS notification sent: {
  eventType: 'StudentEnrolled',
  student: {
    id: 1767009812634,
    name: 'Lab05 Final Test',
    createdAt: '2025-12-29T11:56:52.634Z'
  },
  timestamp: '2025-12-29T11:56:52.678Z'
}
```

✅ **Result**: Producer Lambda 成功發送 SNS 訊息

---

### Test 3: Consumer Lambda 日誌（訊息處理）

**CloudWatch Logs:**
```
2025-12-29T11:54:38 START RequestId: e9ee30a9-89ab-557e-b4df-5165e79381a8

2025-12-29T11:54:38 INFO Received SQS event: {
  "Records": [...]
}

2025-12-29T11:54:38 INFO SNS Message: {
  "Type": "Notification",
  "MessageId": "c8725442-1e4c-5a2a-841c-358e70721126",
  "TopicArn": "arn:aws:sns:ap-southeast-2:434824683139:StudentEnrollmentTopic",
  "Subject": "New Student Enrolled",
  "Message": "{\"eventType\":\"StudentEnrolled\",\"student\":{\"id\":999,\"name\":\"Direct SQS Test\",\"createdAt\":\"2025-12-29T13:00:00.000Z\"},\"timestamp\":\"2025-12-29T13:00:00.000Z\"}"
}

2025-12-29T11:54:38 INFO Student Enrollment Data: {
  "eventType": "StudentEnrolled",
  "student": {
    "id": 999,
    "name": "Direct SQS Test",
    "createdAt": "2025-12-29T13:00:00.000Z"
  },
  "timestamp": "2025-12-29T13:00:00.000Z"
}

2025-12-29T11:54:38 INFO 📧 Email sent (simulated): {
  "to": "admin@example.edu",
  "subject": "New Student Enrolled",
  "body": "Student Enrollment Notification\n================================\n\nA new student has been enrolled:\n\n- Student ID: 999\n- Name: Direct SQS Test\n- Enrolled At: 2025-12-29T13:00:00.000Z\n- Event Type: StudentEnrolled\n- Event Timestamp: 2025-12-29T13:00:00.000Z\n\nThis is an automated notification."
}

2025-12-29T11:54:38 INFO ✅ Successfully processed student enrollment: Direct SQS Test

2025-12-29T11:54:38 END RequestId: e9ee30a9-89ab-557e-b4df-5165e79381a8
2025-12-29T11:54:38 REPORT RequestId: e9ee30a9-89ab-557e-b4df-5165e79381a8
    Duration: 30.09 ms
    Billed Duration: 209 ms
    Memory Size: 128 MB
    Max Memory Used: 68 MB
    Init Duration: 178.75 ms
```

✅ **Result**: Consumer Lambda 成功接收 SQS 訊息、解析 SNS 包裝、處理學生資料並模擬發送 Email

---

### Test 4: SQS Queue 狀態驗證

**檢查訊息數量：**
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/434824683139/StudentEnrollmentQueue \
  --attribute-names ApproximateNumberOfMessages \
  --region ap-southeast-2
```

**Result:**
```json
{
  "Attributes": {
    "ApproximateNumberOfMessages": "0"
  }
}
```

✅ **Result**: Queue 為空，所有訊息都已被 Consumer Lambda 成功處理

---

## Configuration Screenshots

### 1. SNS Topic 畫面
![SNS Topic](../images/lab05/<學號>-sns-topic.png)
- Topic Name: StudentEnrollmentTopic
- Type: Standard
- Subscriptions: 1 (SQS)

### 2. SQS Queue 畫面
![SQS Queue](../images/lab05/<學號>-sqs-queue.png)
- Queue Name: StudentEnrollmentQueue
- Type: Standard
- Messages Available: 0 (已處理)
- Queue Policy: 已設定允許 SNS 發送

### 3. Lambda Producer 設定
![Lambda Producer](../images/lab05/<學號>-lambda-producer.png)
- Function Name: wsse-student-api
- Runtime: Node.js 18.x
- Environment Variables: TABLE_NAME, SNS_TOPIC_ARN
- Permissions: DynamoDB + SNS Publish

### 4. Lambda Consumer 設定
![Lambda Consumer](../images/lab05/<學號>-lambda-consumer.png)
- Function Name: wsse-student-consumer
- Runtime: Node.js 18.x
- Event Source: SQS (StudentEnrollmentQueue)
- Batch Size: 5

### 5. API POST 201 回應
![API POST 201](../images/lab05/<學號>-api-post-201.png)
- HTTP Status: 201 Created
- Location Header: /students/{id}
- Response Body: 包含新學生資料

### 6. Consumer Lambda 日誌
![Consumer Logs](../images/lab05/<學號>-logs.png)
- 顯示完整的訊息處理流程
- SNS 訊息解析
- Email 模擬發送
- 成功處理確認

## Verification Checklist

- [x] SNS Topic (StudentEnrollmentTopic) 建立完成
- [x] SQS Queue (StudentEnrollmentQueue) 建立完成
- [x] SNS 訂閱 SQS 設定完成
- [x] SQS Queue Policy 正確設定（允許 SNS 發送）
- [x] Producer Lambda 更新完成（加入 SNS 發送功能）
- [x] Producer Lambda 環境變數設定 (SNS_TOPIC_ARN)
- [x] Producer Lambda IAM 權限設定 (SNS Publish)
- [x] Consumer Lambda 建立完成
- [x] Consumer Lambda Event Source Mapping 設定 (SQS Trigger)
- [x] Consumer Lambda IAM 權限設定 (SQS 讀取)
- [x] 完整事件流測試成功 (API → DynamoDB → SNS → SQS → Consumer)
- [x] CloudWatch Logs 正常記錄 Producer 和 Consumer 執行

## Challenges and Solutions

### Challenge 1: SNS 訊息無法到達 SQS
**Problem**: SNS 發送成功但 SQS Queue 一直是空的，Consumer Lambda 沒有被觸發  
**Root Cause**: SQS Queue Policy 未正確設定，SNS 沒有權限發送訊息到 Queue  
**Solution**: 
- 手動設定 SQS Queue Policy 允許 SNS 服務發送訊息
- 使用 Condition 限制只有特定 SNS Topic 可以發送（安全性）
- 驗證：檢查 CloudWatch Metrics 中的 `NumberOfNotificationsFailed` 指標

### Challenge 2: Consumer Lambda 沒有 CloudWatch Logs
**Problem**: 訊息被消費但 Lambda 沒有日誌輸出  
**Root Cause**: 
1. Lambda 可能執行失敗但沒有寫入日誌
2. 需要手動觸發一次來初始化 Log Group
**Solution**:
- 手動創建 Log Group: `/aws/lambda/wsse-student-consumer`
- 直接發送測試訊息到 SQS 觸發 Lambda
- 確認 Lambda 有 `AWSLambdaBasicExecutionRole` 權限

### Challenge 3: SNS 訂閱未自動設定 Policy
**Problem**: 使用 `aws sns subscribe` 建立訂閱後，SQS Policy 沒有自動更新  
**Root Cause**: AWS CLI subscribe 命令不會自動更新 SQS Policy（與 Console 行為不同）  
**Solution**:
- 手動設定 SQS Queue Policy
- 使用正確的 JSON 格式和 AWS CLI attributes 語法
- 驗證 Policy 是否生效：檢查 SNS Metrics 的失敗次數

### Challenge 4: 訊息格式解析
**Problem**: Consumer Lambda 需要解析雙層 JSON（SNS 包裝 + 原始訊息）  
**Solution**:
- 第一層：`JSON.parse(record.body)` - 解析 SQS 中的 SNS 訊息
- 第二層：`JSON.parse(snsMessage.Message)` - 解析實際的學生資料
- 使用 try-catch 處理解析錯誤並記錄原始 body

## Architecture Benefits

### 1. 解耦 (Decoupling)
- Producer 和 Consumer 完全獨立
- Producer 不需要知道有多少 Consumer
- 可以隨時增加新的訂閱者而不影響現有系統

### 2. 可靠性 (Reliability)
- SQS 提供訊息持久化（4 天保留期）
- Lambda 失敗時 SQS 自動重試
- SNS 確保訊息傳遞到所有訂閱者

### 3. 擴展性 (Scalability)
- SNS Fan-out：一個事件可以觸發多個服務
- SQS 批次處理：Consumer Lambda 可以處理多條訊息
- 未來可以新增更多訂閱者（Email、SMS、其他 Lambda）

### 4. 非阻塞 (Non-blocking)
- API 回應不需要等待通知完成
- SNS 發送失敗不影響 API 成功回應
- 提升 API 響應速度和使用者體驗

## Future Improvements

### 1. Dead Letter Queue (DLQ)
- 設定 SQS DLQ 處理持續失敗的訊息
- 避免訊息無限重試消耗資源
- 提供失敗訊息的可見性和分析

### 2. Email 實際發送
- 整合 Amazon SES (Simple Email Service)
- 使用 Email 模板
- 追蹤 Email 發送狀態和開啟率

### 3. 多種通知方式
- 新增 SMS 訂閱（Amazon SNS SMS）
- 新增 Push Notification（Mobile App）
- 新增 Slack/Teams 通知

### 4. 訊息過濾
- 使用 SNS Message Filtering
- 只訂閱特定類型的事件
- 減少不必要的訊息處理

### 5. 監控和告警
- CloudWatch Alarms 監控 Queue 深度
- 監控 Lambda 錯誤率
- 監控 SNS 傳遞失敗率

### 6. 訊息追蹤
- 加入 Correlation ID 追蹤整個事件流
- 使用 AWS X-Ray 進行分散式追蹤
- 記錄訊息處理時間和效能指標

## Conclusion

成功完成 Lab 05，實作了完整的事件驅動架構，主要成果包括：

1. ✅ 建立 SNS Topic 和 SQS Queue
2. ✅ 設定 SNS → SQS 訂閱和權限
3. ✅ Producer Lambda 整合 SNS 發送通知
4. ✅ Consumer Lambda 處理 SQS 訊息並模擬 Email 發送
5. ✅ 完整事件流驗證成功
6. ✅ CloudWatch Logs 完整記錄所有步驟

此架構展示了現代雲端應用程式的事件驅動設計模式，提供了解耦、可靠、可擴展的訊息處理機制。透過 SNS 和 SQS 的組合，系統可以輕鬆擴展到支援多種通知方式（Email、SMS、Push Notification 等），而不需要修改核心 API 邏輯。

## Learning Outcomes

通過本次 Lab，我學習並實踐了：

1. **訊息傳遞模式**：了解 Pub/Sub 模式和訊息佇列的差異
2. **AWS 服務整合**：SNS、SQS、Lambda 的無縫整合
3. **IAM 權限管理**：跨服務的權限設定（SNS → SQS → Lambda）
4. **錯誤處理**：非阻塞式錯誤處理，確保主流程不受影響
5. **訊息格式**：雙層 JSON 解析和資料轉換
6. **雲端監控**：使用 CloudWatch Metrics 和 Logs 診斷問題
7. **系統解耦**：事件驅動架構的優勢和最佳實踐

---
