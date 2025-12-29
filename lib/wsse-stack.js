"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsseStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const lambdaEventSources = __importStar(require("aws-cdk-lib/aws-lambda-event-sources"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const path = __importStar(require("path"));
class WsseStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        studentTopic.addSubscription(new subscriptions.SqsSubscription(studentQueue));
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
        consumerLambda.addEventSource(new lambdaEventSources.SqsEventSource(studentQueue, {
            batchSize: 5,
        }));
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
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Producer Lambda Invocations',
            left: [
                producerLambda.metricInvocations({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
                producerLambda.metricErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'Producer Lambda Duration',
            left: [
                producerLambda.metricDuration({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
                producerLambda.metricDuration({ statistic: 'Maximum', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }));
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Consumer Lambda Invocations',
            left: [
                consumerLambda.metricInvocations({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
                consumerLambda.metricErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'Consumer Lambda Duration',
            left: [
                consumerLambda.metricDuration({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }));
        // DynamoDB Metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'DynamoDB Read/Write Operations',
            left: [
                studentsTable.metricConsumedReadCapacityUnits({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
                studentsTable.metricConsumedWriteCapacityUnits({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'DynamoDB Errors',
            left: [
                studentsTable.metricUserErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
                studentsTable.metricSystemErrorsForOperations({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }));
        // SQS Metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'SQS Queue Depth',
            left: [
                studentQueue.metricApproximateNumberOfMessagesVisible({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'SQS Messages Sent/Received',
            left: [
                studentQueue.metricNumberOfMessagesSent({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
                studentQueue.metricNumberOfMessagesReceived({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }));
        // API Gateway Metrics
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'API Gateway Requests',
            left: [
                api.metricCount({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            ],
            right: [
                api.metricClientError({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
                api.metricServerError({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'API Gateway Latency',
            left: [
                api.metricLatency({ statistic: 'Average', period: cdk.Duration.minutes(5) }),
                api.metricLatency({ statistic: 'p99', period: cdk.Duration.minutes(5) }),
            ],
            width: 12,
        }));
        // Alarms Widget
        dashboard.addWidgets(new cloudwatch.AlarmStatusWidget({
            title: 'System Alarms',
            alarms: [
                producerErrorAlarm,
                producerDurationAlarm,
                consumerErrorAlarm,
                dynamoReadThrottleAlarm,
            ],
            width: 24,
        }));
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
exports.WsseStack = WsseStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3NzZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIndzc2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyxpRkFBbUU7QUFDbkUseUZBQTJFO0FBQzNFLHVFQUF5RDtBQUN6RCx1RUFBeUQ7QUFDekQsdUZBQXlFO0FBQ3pFLDJEQUE2QztBQUM3QywyQ0FBNkI7QUFFN0IsTUFBYSxTQUFVLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwyREFBMkQ7UUFDM0QsTUFBTSxhQUFhLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDOUQsU0FBUyxFQUFFLGNBQWM7WUFDekIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxJQUFJO2dCQUNWLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxvQkFBb0I7U0FDL0QsQ0FBQyxDQUFDO1FBRUgsc0RBQXNEO1FBQ3RELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDakUsU0FBUyxFQUFFLDRCQUE0QjtZQUN2QyxXQUFXLEVBQUUsaUNBQWlDO1NBQy9DLENBQUMsQ0FBQztRQUVILHNEQUFzRDtRQUN0RCxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FB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QUUsMkJBQTJCO1lBQ3hDLFVBQVUsRUFBRSxlQUFlO1NBQzVCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSx5REFBeUQsSUFBSSxDQUFDLE1BQU0sb0JBQW9CLFNBQVMsQ0FBQyxhQUFhLEVBQUU7WUFDeEgsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFuVkQsOEJBbVZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xyXG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XHJcbmltcG9ydCAqIGFzIHN1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcclxuaW1wb3J0ICogYXMgbGFtYmRhRXZlbnRTb3VyY2VzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcclxuaW1wb3J0ICogYXMgY2xvdWR3YXRjaF9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xyXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbmV4cG9ydCBjbGFzcyBXc3NlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09IER5bmFtb0RCIFRhYmxlID09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBzdHVkZW50c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTdHVkZW50c1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdTdHVkZW50cy1DREsnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICBuYW1lOiAnaWQnLFxyXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxyXG4gICAgICB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBGb3IgZGVtbyBwdXJwb3Nlc1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT0gU05TIFRvcGljID09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBzdHVkZW50VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdTdHVkZW50RW5yb2xsbWVudFRvcGljJywge1xyXG4gICAgICB0b3BpY05hbWU6ICdTdHVkZW50RW5yb2xsbWVudFRvcGljLUNESycsXHJcbiAgICAgIGRpc3BsYXlOYW1lOiAnU3R1ZGVudCBFbnJvbGxtZW50IEV2ZW50cyAoQ0RLKScsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PSBTUVMgUXVldWUgPT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IHN0dWRlbnRRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1N0dWRlbnRFbnJvbGxtZW50UXVldWUnLCB7XHJcbiAgICAgIHF1ZXVlTmFtZTogJ1N0dWRlbnRFbnJvbGxtZW50UXVldWUtQ0RLJyxcclxuICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cyg0KSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09IFNOUyB0byBTUVMgU3Vic2NyaXB0aW9uID09PT09PT09PT09PT09PT09PT09XHJcbiAgICBzdHVkZW50VG9waWMuYWRkU3Vic2NyaXB0aW9uKFxyXG4gICAgICBuZXcgc3Vic2NyaXB0aW9ucy5TcXNTdWJzY3JpcHRpb24oc3R1ZGVudFF1ZXVlKVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PSBQcm9kdWNlciBMYW1iZGEgRnVuY3Rpb24gPT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IHByb2R1Y2VyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3R1ZGVudEFwaUZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd3c3NlLXN0dWRlbnQtYXBpLWNkaycsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhLXByb2R1Y2VyJykpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFRBQkxFX05BTUU6IHN0dWRlbnRzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFNOU19UT1BJQ19BUk46IHN0dWRlbnRUb3BpYy50b3BpY0FybixcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgIC8vIExhYiAwNzogRW5hYmxlIFgtUmF5IFRyYWNpbmdcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgICAvLyBMYWIgMDc6IFNldCBMb2cgUmV0ZW50aW9uXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gUHJvZHVjZXIgTGFtYmRhXHJcbiAgICBzdHVkZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShwcm9kdWNlckxhbWJkYSk7XHJcbiAgICBzdHVkZW50VG9waWMuZ3JhbnRQdWJsaXNoKHByb2R1Y2VyTGFtYmRhKTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PSBDb25zdW1lciBMYW1iZGEgRnVuY3Rpb24gPT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IGNvbnN1bWVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3R1ZGVudENvbnN1bWVyRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3dzc2Utc3R1ZGVudC1jb25zdW1lci1jZGsnLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYS1jb25zdW1lcicpKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBtZW1vcnlTaXplOiAxMjgsXHJcbiAgICAgIC8vIExhYiAwNzogRW5hYmxlIFgtUmF5IFRyYWNpbmdcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgICAvLyBMYWIgMDc6IFNldCBMb2cgUmV0ZW50aW9uXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR3JhbnQgU1FTIHBlcm1pc3Npb25zIHRvIENvbnN1bWVyIExhbWJkYVxyXG4gICAgc3R1ZGVudFF1ZXVlLmdyYW50Q29uc3VtZU1lc3NhZ2VzKGNvbnN1bWVyTGFtYmRhKTtcclxuXHJcbiAgICAvLyBBZGQgU1FTIGFzIGV2ZW50IHNvdXJjZSBmb3IgQ29uc3VtZXIgTGFtYmRhXHJcbiAgICBjb25zdW1lckxhbWJkYS5hZGRFdmVudFNvdXJjZShcclxuICAgICAgbmV3IGxhbWJkYUV2ZW50U291cmNlcy5TcXNFdmVudFNvdXJjZShzdHVkZW50UXVldWUsIHtcclxuICAgICAgICBiYXRjaFNpemU6IDUsXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09IEFQSSBHYXRld2F5ID09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdTdHVkZW50QXBpJywge1xyXG4gICAgICByZXN0QXBpTmFtZTogJ1N0dWRlbnQgRW5yb2xsbWVudCBBUEkgKENESyknLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3Igc3R1ZGVudCBlbnJvbGxtZW50IHN5c3RlbSAtIGRlcGxveWVkIHZpYSBDREsnLFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XHJcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBzdHVkZW50cyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdzdHVkZW50cycpO1xyXG4gICAgY29uc3Qgc3R1ZGVudEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvZHVjZXJMYW1iZGEpO1xyXG5cclxuICAgIHN0dWRlbnRzLmFkZE1ldGhvZCgnR0VUJywgc3R1ZGVudEludGVncmF0aW9uKTtcclxuICAgIHN0dWRlbnRzLmFkZE1ldGhvZCgnUE9TVCcsIHN0dWRlbnRJbnRlZ3JhdGlvbik7XHJcblxyXG4gICAgY29uc3Qgc3R1ZGVudEJ5SWQgPSBzdHVkZW50cy5hZGRSZXNvdXJjZSgne2lkfScpO1xyXG4gICAgc3R1ZGVudEJ5SWQuYWRkTWV0aG9kKCdHRVQnLCBzdHVkZW50SW50ZWdyYXRpb24pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09IExhYiAwNzogQ2xvdWRXYXRjaCBNZXRyaWNzICYgQWxhcm1zID09PT09PT09PT09PT09PT09PT09XHJcbiAgICBcclxuICAgIC8vIFNOUyBUb3BpYyBmb3IgQWxhcm1zXHJcbiAgICBjb25zdCBhbGFybVRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnQWxhcm1Ub3BpYycsIHtcclxuICAgICAgdG9waWNOYW1lOiAnV1NTRS1BbGFybXMtQ0RLJyxcclxuICAgICAgZGlzcGxheU5hbWU6ICdXU1NFIFN5c3RlbSBBbGFybXMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gUHJvZHVjZXIgTGFtYmRhIEVycm9yIEFsYXJtXHJcbiAgICBjb25zdCBwcm9kdWNlckVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnUHJvZHVjZXJMYW1iZGFFcnJvckFsYXJtJywge1xyXG4gICAgICBhbGFybU5hbWU6ICdXU1NFLVByb2R1Y2VyLUxhbWJkYS1FcnJvcnMnLFxyXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgd2hlbiBQcm9kdWNlciBMYW1iZGEgaGFzIGVycm9ycycsXHJcbiAgICAgIG1ldHJpYzogcHJvZHVjZXJMYW1iZGEubWV0cmljRXJyb3JzKHtcclxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIH0pLFxyXG4gICAgICB0aHJlc2hvbGQ6IDMsXHJcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxyXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXHJcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxyXG4gICAgfSk7XHJcbiAgICBwcm9kdWNlckVycm9yQWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oYWxhcm1Ub3BpYykpO1xyXG5cclxuICAgIC8vIFByb2R1Y2VyIExhbWJkYSBEdXJhdGlvbiBBbGFybVxyXG4gICAgY29uc3QgcHJvZHVjZXJEdXJhdGlvbkFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1Byb2R1Y2VyTGFtYmRhRHVyYXRpb25BbGFybScsIHtcclxuICAgICAgYWxhcm1OYW1lOiAnV1NTRS1Qcm9kdWNlci1MYW1iZGEtRHVyYXRpb24nLFxyXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgd2hlbiBQcm9kdWNlciBMYW1iZGEgZXhlY3V0aW9uIHRpbWUgaXMgdG9vIGxvbmcnLFxyXG4gICAgICBtZXRyaWM6IHByb2R1Y2VyTGFtYmRhLm1ldHJpY0R1cmF0aW9uKHtcclxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxyXG4gICAgICB9KSxcclxuICAgICAgdGhyZXNob2xkOiA1MDAwLCAvLyA1IHNlY29uZHNcclxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXHJcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcclxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXHJcbiAgICB9KTtcclxuICAgIHByb2R1Y2VyRHVyYXRpb25BbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihhbGFybVRvcGljKSk7XHJcblxyXG4gICAgLy8gQ29uc3VtZXIgTGFtYmRhIEVycm9yIEFsYXJtXHJcbiAgICBjb25zdCBjb25zdW1lckVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQ29uc3VtZXJMYW1iZGFFcnJvckFsYXJtJywge1xyXG4gICAgICBhbGFybU5hbWU6ICdXU1NFLUNvbnN1bWVyLUxhbWJkYS1FcnJvcnMnLFxyXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnVHJpZ2dlcnMgd2hlbiBDb25zdW1lciBMYW1iZGEgaGFzIGVycm9ycycsXHJcbiAgICAgIG1ldHJpYzogY29uc3VtZXJMYW1iZGEubWV0cmljRXJyb3JzKHtcclxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIH0pLFxyXG4gICAgICB0aHJlc2hvbGQ6IDMsXHJcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxyXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXHJcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxyXG4gICAgfSk7XHJcbiAgICBjb25zdW1lckVycm9yQWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oYWxhcm1Ub3BpYykpO1xyXG5cclxuICAgIC8vIER5bmFtb0RCIFJlYWQgVGhyb3R0bGUgQWxhcm1cclxuICAgIGNvbnN0IGR5bmFtb1JlYWRUaHJvdHRsZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0R5bmFtb0RCUmVhZFRocm90dGxlQWxhcm0nLCB7XHJcbiAgICAgIGFsYXJtTmFtZTogJ1dTU0UtRHluYW1vREItUmVhZC1UaHJvdHRsZScsXHJcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdUcmlnZ2VycyB3aGVuIER5bmFtb0RCIHJlYWQgcmVxdWVzdHMgYXJlIHRocm90dGxlZCcsXHJcbiAgICAgIG1ldHJpYzogc3R1ZGVudHNUYWJsZS5tZXRyaWNVc2VyRXJyb3JzKHtcclxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIH0pLFxyXG4gICAgICB0aHJlc2hvbGQ6IDUsXHJcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxyXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXHJcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxyXG4gICAgfSk7XHJcbiAgICBkeW5hbW9SZWFkVGhyb3R0bGVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihhbGFybVRvcGljKSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT0gTGFiIDA3OiBDbG91ZFdhdGNoIERhc2hib2FyZCA9PT09PT09PT09PT09PT09PT09PVxyXG4gICAgXHJcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ1dzc2VEYXNoYm9hcmQnLCB7XHJcbiAgICAgIGRhc2hib2FyZE5hbWU6ICdXU1NFLVN0dWRlbnQtRW5yb2xsbWVudC1TeXN0ZW0nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTGFtYmRhIE1ldHJpY3NcclxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdQcm9kdWNlciBMYW1iZGEgSW52b2NhdGlvbnMnLFxyXG4gICAgICAgIGxlZnQ6IFtcclxuICAgICAgICAgIHByb2R1Y2VyTGFtYmRhLm1ldHJpY0ludm9jYXRpb25zKHsgc3RhdGlzdGljOiAnU3VtJywgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSB9KSxcclxuICAgICAgICAgIHByb2R1Y2VyTGFtYmRhLm1ldHJpY0Vycm9ycyh7IHN0YXRpc3RpYzogJ1N1bScsIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aWR0aDogMTIsXHJcbiAgICAgIH0pLFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdQcm9kdWNlciBMYW1iZGEgRHVyYXRpb24nLFxyXG4gICAgICAgIGxlZnQ6IFtcclxuICAgICAgICAgIHByb2R1Y2VyTGFtYmRhLm1ldHJpY0R1cmF0aW9uKHsgc3RhdGlzdGljOiAnQXZlcmFnZScsIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXHJcbiAgICAgICAgICBwcm9kdWNlckxhbWJkYS5tZXRyaWNEdXJhdGlvbih7IHN0YXRpc3RpYzogJ01heGltdW0nLCBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2lkdGg6IDEyLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnQ29uc3VtZXIgTGFtYmRhIEludm9jYXRpb25zJyxcclxuICAgICAgICBsZWZ0OiBbXHJcbiAgICAgICAgICBjb25zdW1lckxhbWJkYS5tZXRyaWNJbnZvY2F0aW9ucyh7IHN0YXRpc3RpYzogJ1N1bScsIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXHJcbiAgICAgICAgICBjb25zdW1lckxhbWJkYS5tZXRyaWNFcnJvcnMoeyBzdGF0aXN0aWM6ICdTdW0nLCBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2lkdGg6IDEyLFxyXG4gICAgICB9KSxcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnQ29uc3VtZXIgTGFtYmRhIER1cmF0aW9uJyxcclxuICAgICAgICBsZWZ0OiBbXHJcbiAgICAgICAgICBjb25zdW1lckxhbWJkYS5tZXRyaWNEdXJhdGlvbih7IHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLCBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2lkdGg6IDEyLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBEeW5hbW9EQiBNZXRyaWNzXHJcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnRHluYW1vREIgUmVhZC9Xcml0ZSBPcGVyYXRpb25zJyxcclxuICAgICAgICBsZWZ0OiBbXHJcbiAgICAgICAgICBzdHVkZW50c1RhYmxlLm1ldHJpY0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMoeyBzdGF0aXN0aWM6ICdTdW0nLCBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxyXG4gICAgICAgICAgc3R1ZGVudHNUYWJsZS5tZXRyaWNDb25zdW1lZFdyaXRlQ2FwYWNpdHlVbml0cyh7IHN0YXRpc3RpYzogJ1N1bScsIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aWR0aDogMTIsXHJcbiAgICAgIH0pLFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdEeW5hbW9EQiBFcnJvcnMnLFxyXG4gICAgICAgIGxlZnQ6IFtcclxuICAgICAgICAgIHN0dWRlbnRzVGFibGUubWV0cmljVXNlckVycm9ycyh7IHN0YXRpc3RpYzogJ1N1bScsIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXHJcbiAgICAgICAgICBzdHVkZW50c1RhYmxlLm1ldHJpY1N5c3RlbUVycm9yc0Zvck9wZXJhdGlvbnMoeyBzdGF0aXN0aWM6ICdTdW0nLCBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2lkdGg6IDEyLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBTUVMgTWV0cmljc1xyXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXHJcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcclxuICAgICAgICB0aXRsZTogJ1NRUyBRdWV1ZSBEZXB0aCcsXHJcbiAgICAgICAgbGVmdDogW1xyXG4gICAgICAgICAgc3R1ZGVudFF1ZXVlLm1ldHJpY0FwcHJveGltYXRlTnVtYmVyT2ZNZXNzYWdlc1Zpc2libGUoeyBzdGF0aXN0aWM6ICdBdmVyYWdlJywgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSB9KSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHdpZHRoOiAxMixcclxuICAgICAgfSksXHJcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcclxuICAgICAgICB0aXRsZTogJ1NRUyBNZXNzYWdlcyBTZW50L1JlY2VpdmVkJyxcclxuICAgICAgICBsZWZ0OiBbXHJcbiAgICAgICAgICBzdHVkZW50UXVldWUubWV0cmljTnVtYmVyT2ZNZXNzYWdlc1NlbnQoeyBzdGF0aXN0aWM6ICdTdW0nLCBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxyXG4gICAgICAgICAgc3R1ZGVudFF1ZXVlLm1ldHJpY051bWJlck9mTWVzc2FnZXNSZWNlaXZlZCh7IHN0YXRpc3RpYzogJ1N1bScsIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aWR0aDogMTIsXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEFQSSBHYXRld2F5IE1ldHJpY3NcclxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdBUEkgR2F0ZXdheSBSZXF1ZXN0cycsXHJcbiAgICAgICAgbGVmdDogW1xyXG4gICAgICAgICAgYXBpLm1ldHJpY0NvdW50KHsgc3RhdGlzdGljOiAnU3VtJywgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSB9KSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJpZ2h0OiBbXHJcbiAgICAgICAgICBhcGkubWV0cmljQ2xpZW50RXJyb3IoeyBzdGF0aXN0aWM6ICdTdW0nLCBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpIH0pLFxyXG4gICAgICAgICAgYXBpLm1ldHJpY1NlcnZlckVycm9yKHsgc3RhdGlzdGljOiAnU3VtJywgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSB9KSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHdpZHRoOiAxMixcclxuICAgICAgfSksXHJcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcclxuICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IExhdGVuY3knLFxyXG4gICAgICAgIGxlZnQ6IFtcclxuICAgICAgICAgIGFwaS5tZXRyaWNMYXRlbmN5KHsgc3RhdGlzdGljOiAnQXZlcmFnZScsIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXHJcbiAgICAgICAgICBhcGkubWV0cmljTGF0ZW5jeSh7IHN0YXRpc3RpYzogJ3A5OScsIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXHJcbiAgICAgICAgXSxcclxuICAgICAgICB3aWR0aDogMTIsXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEFsYXJtcyBXaWRnZXRcclxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5BbGFybVN0YXR1c1dpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdTeXN0ZW0gQWxhcm1zJyxcclxuICAgICAgICBhbGFybXM6IFtcclxuICAgICAgICAgIHByb2R1Y2VyRXJyb3JBbGFybSxcclxuICAgICAgICAgIHByb2R1Y2VyRHVyYXRpb25BbGFybSxcclxuICAgICAgICAgIGNvbnN1bWVyRXJyb3JBbGFybSxcclxuICAgICAgICAgIGR5bmFtb1JlYWRUaHJvdHRsZUFsYXJtLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgd2lkdGg6IDI0LFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PSBTdGFjayBPdXRwdXRzID09PT09PT09PT09PT09PT09PT09XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpRW5kcG9pbnQnLCB7XHJcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IEVuZHBvaW50IFVSTCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdXc3NlQXBpRW5kcG9pbnQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0R5bmFtb0RCVGFibGVOYW1lJywge1xyXG4gICAgICB2YWx1ZTogc3R1ZGVudHNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgVGFibGUgTmFtZScsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdXc3NlRHluYW1vREJUYWJsZScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU05TVG9waWNBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiBzdHVkZW50VG9waWMudG9waWNBcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU05TIFRvcGljIEFSTicsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdXc3NlU05TVG9waWMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NRU1F1ZXVlVXJsJywge1xyXG4gICAgICB2YWx1ZTogc3R1ZGVudFF1ZXVlLnF1ZXVlVXJsLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1NRUyBRdWV1ZSBVUkwnLFxyXG4gICAgICBleHBvcnROYW1lOiAnV3NzZVNRU1F1ZXVlJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcm9kdWNlckxhbWJkYUFybicsIHtcclxuICAgICAgdmFsdWU6IHByb2R1Y2VyTGFtYmRhLmZ1bmN0aW9uQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1Byb2R1Y2VyIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxyXG4gICAgICBleHBvcnROYW1lOiAnV3NzZVByb2R1Y2VyTGFtYmRhJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb25zdW1lckxhbWJkYUFybicsIHtcclxuICAgICAgdmFsdWU6IGNvbnN1bWVyTGFtYmRhLmZ1bmN0aW9uQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbnN1bWVyIExhbWJkYSBGdW5jdGlvbiBBUk4nLFxyXG4gICAgICBleHBvcnROYW1lOiAnV3NzZUNvbnN1bWVyTGFtYmRhJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGFybVRvcGljQXJuJywge1xyXG4gICAgICB2YWx1ZTogYWxhcm1Ub3BpYy50b3BpY0FybixcclxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgVG9waWMgQVJOIGZvciBBbGFybXMnLFxyXG4gICAgICBleHBvcnROYW1lOiAnV3NzZUFsYXJtVG9waWMnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBkYXNoYm9hcmQuZGFzaGJvYXJkTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFdhdGNoIERhc2hib2FyZCBOYW1lJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1dzc2VEYXNoYm9hcmQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZFVybCcsIHtcclxuICAgICAgdmFsdWU6IGBodHRwczovL2NvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHtkYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggRGFzaGJvYXJkIFVSTCcsXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19