# Lab 7 Submission - CloudWatch Observability

## Overview

本實驗實作了完整的 AWS 可觀測性（Observability）功能，包括：
- Lambda 函數的 Log Retention 設定
- AWS X-Ray 分散式追蹤
- CloudWatch Metrics 監控指標
- CloudWatch Alarms 告警設定
- CloudWatch Dashboard 監控儀表板

## Implementation Details

### 1. Lambda Log Retention & X-Ray Tracing

在 CDK Stack 中為所有 Lambda 函數啟用：

```typescript
// Producer Lambda
const producerLambda = new lambda.Function(this, 'StudentApiFunction', {
  functionName: 'wsse-student-api-cdk',
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-producer')),
  environment: {
    TABLE_NAME: studentsTable.tableName,
    SNS_TOPIC_ARN: studentTopic.topicArn,
  },
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
  // Lab 07: Enable X-Ray Tracing
  tracing: lambda.Tracing.ACTIVE,
  // Lab 07: Set Log Retention to 7 days
  logRetention: logs.RetentionDays.ONE_WEEK,
});

// Consumer Lambda
const consumerLambda = new lambda.Function(this, 'StudentConsumerFunction', {
  functionName: 'wsse-student-consumer-cdk',
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-consumer')),
  timeout: cdk.Duration.seconds(30),
  memorySize: 128,
  // Lab 07: Enable X-Ray Tracing
  tracing: lambda.Tracing.ACTIVE,
  // Lab 07: Set Log Retention to 7 days
  logRetention: logs.RetentionDays.ONE_WEEK,
});
```

### 2. CloudWatch Metrics

定義了關鍵的監控指標：

```typescript
// Producer Lambda Metrics
const producerErrors = producerLambda.metricErrors({
  period: cdk.Duration.minutes(5),
  statistic: 'Sum',
});

const producerDuration = producerLambda.metricDuration({
  period: cdk.Duration.minutes(5),
  statistic: 'Average',
});

// Consumer Lambda Metrics
const consumerErrors = consumerLambda.metricErrors({
  period: cdk.Duration.minutes(5),
  statistic: 'Sum',
});

// DynamoDB Metrics
const dynamoReadThrottle = studentsTable.metricUserErrors({
  period: cdk.Duration.minutes(5),
  statistic: 'Sum',
});
```

### 3. CloudWatch Alarms

建立了 4 個告警監控關鍵指標：

```typescript
// SNS Topic for Alarms
const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
  topicName: 'WSSE-Alarms-CDK',
  displayName: 'WSSE System Alarms',
});

// 1. Producer Lambda Error Alarm
const producerErrorAlarm = new cloudwatch.Alarm(this, 'ProducerErrorAlarm', {
  alarmName: 'WSSE-Producer-Errors',
  metric: producerErrors,
  threshold: 3,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  alarmDescription: 'Alert when Producer Lambda has >= 3 errors in 5 minutes',
});
producerErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

// 2. Producer Lambda Duration Alarm
const producerDurationAlarm = new cloudwatch.Alarm(this, 'ProducerDurationAlarm', {
  alarmName: 'WSSE-Producer-Duration',
  metric: producerDuration,
  threshold: 5000,
  evaluationPeriods: 2,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  alarmDescription: 'Alert when Producer Lambda duration > 5000ms for 2 periods',
});
producerDurationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

// 3. Consumer Lambda Error Alarm
const consumerErrorAlarm = new cloudwatch.Alarm(this, 'ConsumerErrorAlarm', {
  alarmName: 'WSSE-Consumer-Errors',
  metric: consumerErrors,
  threshold: 3,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  alarmDescription: 'Alert when Consumer Lambda has >= 3 errors in 5 minutes',
});
consumerErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

// 4. DynamoDB Throttle Alarm
const dynamoReadThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoReadThrottleAlarm', {
  alarmName: 'WSSE-DynamoDB-Throttle',
  metric: dynamoReadThrottle,
  threshold: 5,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  alarmDescription: 'Alert when DynamoDB has >= 5 throttled requests in 5 minutes',
});
dynamoReadThrottleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
```

### 4. CloudWatch Dashboard

建立了包含 10 個 Widget 的綜合監控儀表板：

```typescript
const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
  dashboardName: 'WSSE-Student-Enrollment-System',
});

// Add widgets to dashboard
dashboard.addWidgets(
  // Row 1: Lambda Invocations
  new cloudwatch.GraphWidget({
    title: 'Lambda Invocations',
    left: [
      producerLambda.metricInvocations(),
      consumerLambda.metricInvocations(),
    ],
    width: 12,
  }),
  new cloudwatch.GraphWidget({
    title: 'Lambda Errors',
    left: [producerErrors, consumerErrors],
    width: 12,
  })
);

dashboard.addWidgets(
  // Row 2: Lambda Duration and DynamoDB Operations
  new cloudwatch.GraphWidget({
    title: 'Lambda Duration',
    left: [producerDuration],
    width: 8,
  }),
  new cloudwatch.GraphWidget({
    title: 'DynamoDB Operations',
    left: [
      studentsTable.metricConsumedReadCapacityUnits(),
      studentsTable.metricConsumedWriteCapacityUnits(),
    ],
    width: 8,
  }),
  new cloudwatch.GraphWidget({
    title: 'DynamoDB Errors',
    left: [dynamoReadThrottle],
    width: 8,
  })
);

dashboard.addWidgets(
  // Row 3: SQS Metrics
  new cloudwatch.GraphWidget({
    title: 'SQS Queue Depth',
    left: [studentQueue.metricApproximateNumberOfMessagesVisible()],
    width: 12,
  }),
  new cloudwatch.GraphWidget({
    title: 'SQS Messages',
    left: [
      studentQueue.metricNumberOfMessagesSent(),
      studentQueue.metricNumberOfMessagesReceived(),
    ],
    width: 12,
  })
);

dashboard.addWidgets(
  // Row 4: API Gateway & Alarms
  new cloudwatch.GraphWidget({
    title: 'API Gateway Requests',
    left: [api.metricCount()],
    width: 8,
  }),
  new cloudwatch.GraphWidget({
    title: 'API Gateway Latency',
    left: [api.metricLatency()],
    width: 8,
  }),
  new cloudwatch.AlarmStatusWidget({
    title: 'Alarm Status',
    alarms: [
      producerErrorAlarm,
      producerDurationAlarm,
      consumerErrorAlarm,
      dynamoReadThrottleAlarm,
    ],
    width: 8,
  })
);
```

## Issues and Solutions

### Issue 1: Lambda Region 配置錯誤

**問題描述：**
部署後所有 API 請求返回 500 錯誤。檢查 CloudWatch Logs 發現：
```
AccessDeniedException: User is not authorized to perform: dynamodb:Scan 
on resource: arn:aws:dynamodb:ap-southeast-2:434824683139:table/Students-CDK
```

**根本原因：**
Lambda 函數代碼中硬編碼了錯誤的 region：
```javascript
const ddbClient = new DynamoDBClient({ region: "ap-southeast-2" });
const snsClient = new SNSClient({ region: "ap-southeast-2" });
```
而實際資源部署在 `ap-northeast-1`。

**解決方案：**
修正 Lambda 代碼中的 region 配置：
```javascript
const ddbClient = new DynamoDBClient({ region: "ap-northeast-1" });
const snsClient = new SNSClient({ region: "ap-northeast-1" });
```

重新部署後 API 恢復正常，成功建立測試數據。

### Issue 2: 監控數據不足

**問題描述：**
初始部署後 CloudWatch Dashboard 沒有足夠的監控數據。

**解決方案：**
執行測試腳本產生監控數據：
- 建立 15 個測試學生（POST 請求）
- 執行 20+ 次 Producer Lambda
- 執行 10+ 次 Consumer Lambda
- 觸發 SNS → SQS → Lambda 事件流

成功產生足夠的 metrics 和 X-Ray traces 供儀表板展示。

## Monitoring Resources

### CloudWatch Dashboard
```
https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=WSSE-Student-Enrollment-System
```

### Lambda Logs
- **Producer Lambda Logs:**
  ```
  /aws/lambda/wsse-student-api-cdk
  ```
  
- **Consumer Lambda Logs:**
  ```
  /aws/lambda/wsse-student-consumer-cdk
  ```

### X-Ray Service Map
```
https://console.aws.amazon.com/xray/home?region=ap-northeast-1#/service-map
```

可以看到完整的服務調用鏈路：
- API Gateway → Producer Lambda
- Producer Lambda → DynamoDB
- Producer Lambda → SNS
- SNS → SQS
- SQS → Consumer Lambda

### CloudWatch Alarms
```
https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#alarmsV2:
```

4 個告警全部處於 "OK" 狀態，監控系統正常運作。

## Deployment Output

```
✅  WsseStack

Outputs:
WsseStack.AlarmTopicArn = arn:aws:sns:ap-northeast-1:434824683139:WSSE-Alarms-CDK
WsseStack.ApiEndpoint = https://pi0mnl4i2c.execute-api.ap-northeast-1.amazonaws.com/prod/
WsseStack.ConsumerLambdaArn = arn:aws:lambda:ap-northeast-1:434824683139:function:wsse-student-consumer-cdk
WsseStack.DashboardName = WSSE-Student-Enrollment-System
WsseStack.DashboardUrl = https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=WSSE-Student-Enrollment-System
WsseStack.DynamoDBTableName = Students-CDK
WsseStack.ProducerLambdaArn = arn:aws:lambda:ap-northeast-1:434824683139:function:wsse-student-api-cdk
WsseStack.SNSTopicArn = arn:aws:sns:ap-northeast-1:434824683139:StudentEnrollmentTopic-CDK
WsseStack.SQSQueueUrl = https://sqs.ap-northeast-1.amazonaws.com/434824683139/StudentEnrollmentQueue-CDK
```

## Test Results

### API Testing
- ✅ GET /students - 成功返回 15 筆學生數據
- ✅ POST /students - 成功建立新學生並觸發事件
- ✅ DynamoDB 寫入成功
- ✅ SNS 發布成功
- ✅ SQS 接收成功
- ✅ Consumer Lambda 處理成功

### Monitoring Verification
- ✅ **Log Retention**: 兩個 Lambda 都設定為 7 天保留期
- ✅ **X-Ray Tracing**: 啟用並可在 Service Map 看到完整鏈路
- ✅ **CloudWatch Metrics**: Dashboard 顯示完整的 metrics 數據
- ✅ **CloudWatch Alarms**: 4 個告警全部正常運作
- ✅ **Dashboard Widgets**: 10 個 widgets 正常顯示數據

## Screenshots Location

所有截圖應放置在：
```
images/lab07/
├── 01-lambda-logs-producer.png      # Producer Lambda CloudWatch Logs
├── 02-lambda-logs-consumer.png      # Consumer Lambda CloudWatch Logs
├── 03-xray-service-map.png          # X-Ray Service Map
├── 04-cloudwatch-dashboard.png      # CloudWatch Dashboard 完整視圖
├── 05-cloudwatch-alarms.png         # CloudWatch Alarms 狀態
└── 06-metrics-detail.png            # 單個 Metric 的詳細圖表
```

## Summary

本實驗成功實作了：
1. ✅ Lambda Log Retention（7 天）
2. ✅ AWS X-Ray 分散式追蹤
3. ✅ CloudWatch Metrics 監控
4. ✅ CloudWatch Alarms（4 個告警）
5. ✅ CloudWatch Dashboard（10 個 widgets）
6. ✅ 完整的事件驅動架構監控
7. ✅ 成功生成測試數據驗證監控功能

所有監控組件已部署並正常運作，可透過 CloudWatch Console 查看即時監控數據。
