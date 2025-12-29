import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export class WsseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==================== DynamoDB Table ====================
    const studentsTable = new dynamodb.Table(this, 'StudentsTable', {
      tableName: 'Students-CDK',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For demo purposes
    });

    // ==================== SNS Topic ====================
    const studentTopic = new sns.Topic(this, 'StudentEnrollmentTopic', {
      topicName: 'StudentEnrollmentTopic-CDK',
      displayName: 'Student Enrollment Events (CDK)',
    });

    // ==================== SQS Queue ====================
    const studentQueue = new sqs.Queue(this, 'StudentEnrollmentQueue', {
      queueName: 'StudentEnrollmentQueue-CDK',
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(4),
    });

    // ==================== SNS to SQS Subscription ====================
    studentTopic.addSubscription(
      new subscriptions.SqsSubscription(studentQueue)
    );

    // ==================== Producer Lambda Function ====================
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
      // Lab 07: Set Log Retention
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to Producer Lambda
    studentsTable.grantReadWriteData(producerLambda);
    studentTopic.grantPublish(producerLambda);

    // ==================== Consumer Lambda Function ====================
    const consumerLambda = new lambda.Function(this, 'StudentConsumerFunction', {
      functionName: 'wsse-student-consumer-cdk',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-consumer')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      // Lab 07: Enable X-Ray Tracing
      tracing: lambda.Tracing.ACTIVE,
      // Lab 07: Set Log Retention
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant SQS permissions to Consumer Lambda
    studentQueue.grantConsumeMessages(consumerLambda);

    // Add SQS as event source for Consumer Lambda
    consumerLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(studentQueue, {
        batchSize: 5,
      })
    );

    // ==================== API Gateway ====================
    const api = new apigateway.RestApi(this, 'StudentApi', {
      restApiName: 'Student Enrollment API (CDK)',
      description: 'API for student enrollment system - deployed via CDK',
      deployOptions: {
        stageName: 'prod',
      },
    });

    const students = api.root.addResource('students');
    const studentIntegration = new apigateway.LambdaIntegration(producerLambda);

    students.addMethod('GET', studentIntegration);
    students.addMethod('POST', studentIntegration);

    const studentById = students.addResource('{id}');
    studentById.addMethod('GET', studentIntegration);

    // ==================== Lab 07: CloudWatch Metrics & Alarms ====================
    
    // SNS Topic for Alarms
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: 'WSSE-Alarms-CDK',
      displayName: 'WSSE System Alarms',
    });

    // Producer Lambda Error Alarm
    const producerErrorAlarm = new cloudwatch.Alarm(this, 'ProducerLambdaErrorAlarm', {
      alarmName: 'WSSE-Producer-Lambda-Errors',
      alarmDescription: 'Triggers when Producer Lambda has errors',
      metric: producerLambda.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    producerErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Producer Lambda Duration Alarm
    const producerDurationAlarm = new cloudwatch.Alarm(this, 'ProducerLambdaDurationAlarm', {
      alarmName: 'WSSE-Producer-Lambda-Duration',
      alarmDescription: 'Triggers when Producer Lambda execution time is too long',
      metric: producerLambda.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    producerDurationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // Consumer Lambda Error Alarm
    const consumerErrorAlarm = new cloudwatch.Alarm(this, 'ConsumerLambdaErrorAlarm', {
      alarmName: 'WSSE-Consumer-Lambda-Errors',
      alarmDescription: 'Triggers when Consumer Lambda has errors',
      metric: consumerLambda.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    consumerErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // DynamoDB Read Throttle Alarm
    const dynamoReadThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDBReadThrottleAlarm', {
      alarmName: 'WSSE-DynamoDB-Read-Throttle',
      alarmDescription: 'Triggers when DynamoDB read requests are throttled',
      metric: studentsTable.metricUserErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dynamoReadThrottleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

    // ==================== Lab 07: CloudWatch Dashboard ====================
    
    const dashboard = new cloudwatch.Dashboard(this, 'WsseDashboard', {
      dashboardName: 'WSSE-Student-Enrollment-System',
    });

    // Lambda Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Producer Lambda Invocations',
        left: [
          producerLambda.metricInvocations({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          producerLambda.metricErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Producer Lambda Duration',
        left: [
          producerLambda.metricDuration({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
          producerLambda.metricDuration({ statistic: 'Maximum', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Consumer Lambda Invocations',
        left: [
          consumerLambda.metricInvocations({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          consumerLambda.metricErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Consumer Lambda Duration',
        left: [
          consumerLambda.metricDuration({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      })
    );

    // DynamoDB Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Read/Write Operations',
        left: [
          studentsTable.metricConsumedReadCapacityUnits({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          studentsTable.metricConsumedWriteCapacityUnits({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Errors',
        left: [
          studentsTable.metricUserErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          studentsTable.metricSystemErrorsForOperations({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      })
    );

    // SQS Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'SQS Queue Depth',
        left: [
          studentQueue.metricApproximateNumberOfMessagesVisible({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'SQS Messages Sent/Received',
        left: [
          studentQueue.metricNumberOfMessagesSent({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          studentQueue.metricNumberOfMessagesReceived({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      })
    );

    // API Gateway Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [
          api.metricCount({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        ],
        right: [
          api.metricClientError({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
          api.metricServerError({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency',
        left: [
          api.metricLatency({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
          api.metricLatency({ statistic: 'p99', period: cdk.Duration.minutes(5) }),
        ],
        width: 12,
      })
    );

    // Alarms Widget
    dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: 'System Alarms',
        alarms: [
          producerErrorAlarm,
          producerDurationAlarm,
          consumerErrorAlarm,
          dynamoReadThrottleAlarm,
        ],
        width: 24,
      })
    );

    // ==================== Stack Outputs ====================
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway Endpoint URL',
      exportName: 'WsseApiEndpoint',
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: studentsTable.tableName,
      description: 'DynamoDB Table Name',
      exportName: 'WsseDynamoDBTable',
    });

    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: studentTopic.topicArn,
      description: 'SNS Topic ARN',
      exportName: 'WsseSNSTopic',
    });

    new cdk.CfnOutput(this, 'SQSQueueUrl', {
      value: studentQueue.queueUrl,
      description: 'SQS Queue URL',
      exportName: 'WsseSQSQueue',
    });

    new cdk.CfnOutput(this, 'ProducerLambdaArn', {
      value: producerLambda.functionArn,
      description: 'Producer Lambda Function ARN',
      exportName: 'WsseProducerLambda',
    });

    new cdk.CfnOutput(this, 'ConsumerLambdaArn', {
      value: consumerLambda.functionArn,
      description: 'Consumer Lambda Function ARN',
      exportName: 'WsseConsumerLambda',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarmTopic.topicArn,
      description: 'SNS Topic ARN for Alarms',
      exportName: 'WsseAlarmTopic',
    });

    new cdk.CfnOutput(this, 'DashboardName', {
      value: dashboard.dashboardName,
      description: 'CloudWatch Dashboard Name',
      exportName: 'WsseDashboard',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
