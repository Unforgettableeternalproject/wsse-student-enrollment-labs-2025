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
    }
}
exports.WsseStack = WsseStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3NzZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIndzc2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQyxpRkFBbUU7QUFDbkUseUZBQTJFO0FBQzNFLHVFQUF5RDtBQUN6RCwyQ0FBNkI7QUFFN0IsTUFBYSxTQUFVLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwyREFBMkQ7UUFDM0QsTUFBTSxhQUFhLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDOUQsU0FBUyxFQUFFLGNBQWM7WUFDekIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxJQUFJO2dCQUNWLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxvQkFBb0I7U0FDL0QsQ0FBQyxDQUFDO1FBRUgsc0RBQXNEO1FBQ3RELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDakUsU0FBUyxFQUFFLDRCQUE0QjtZQUN2QyxXQUFXLEVBQUUsaUNBQWlDO1NBQy9DLENBQUMsQ0FBQztRQUVILHNEQUFzRDtRQUN0RCxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQ2pFLFNBQVMsRUFBRSw0QkFBNEI7WUFDdkMsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzNDLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsb0VBQW9FO1FBQ3BFLFlBQVksQ0FBQyxlQUFlLENBQzFCLElBQUksYUFBYSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FDaEQsQ0FBQztRQUVGLHFFQUFxRTtRQUNyRSxNQUFNLGNBQWMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3JFLFlBQVksRUFBRSxzQkFBc0I7WUFDcEMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUN2RSxXQUFXLEVBQUU7Z0JBQ1gsVUFBVSxFQUFFLGFBQWEsQ0FBQyxTQUFTO2dCQUNuQyxhQUFhLEVBQUUsWUFBWSxDQUFDLFFBQVE7YUFDckM7WUFDRCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1NBQ2hCLENBQUMsQ0FBQztRQUVILHVDQUF1QztRQUN2QyxhQUFhLENBQUMsa0JBQWtCLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDakQsWUFBWSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUUxQyxxRUFBcUU7UUFDckUsTUFBTSxjQUFjLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUMxRSxZQUFZLEVBQUUsMkJBQTJCO1lBQ3pDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7WUFDdkUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztTQUNoQixDQUFDLENBQUM7UUFFSCwyQ0FBMkM7UUFDM0MsWUFBWSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRWxELDhDQUE4QztRQUM5QyxjQUFjLENBQUMsY0FBYyxDQUMzQixJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUU7WUFDbEQsU0FBUyxFQUFFLENBQUM7U0FDYixDQUFDLENBQ0gsQ0FBQztRQUVGLHdEQUF3RDtRQUN4RCxNQUFNLEdBQUcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNyRCxXQUFXLEVBQUUsOEJBQThCO1lBQzNDLFdBQVcsRUFBRSxzREFBc0Q7WUFDbkUsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxNQUFNO2FBQ2xCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbEQsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUU1RSxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQzlDLFFBQVEsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFFL0MsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqRCxXQUFXLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBRWpELDBEQUEwRDtRQUMxRCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUc7WUFDZCxXQUFXLEVBQUUsMEJBQTBCO1lBQ3ZDLFVBQVUsRUFBRSxpQkFBaUI7U0FDOUIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsYUFBYSxDQUFDLFNBQVM7WUFDOUIsV0FBVyxFQUFFLHFCQUFxQjtZQUNsQyxVQUFVLEVBQUUsbUJBQW1CO1NBQ2hDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLEtBQUssRUFBRSxZQUFZLENBQUMsUUFBUTtZQUM1QixXQUFXLEVBQUUsZUFBZTtZQUM1QixVQUFVLEVBQUUsY0FBYztTQUMzQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsWUFBWSxDQUFDLFFBQVE7WUFDNUIsV0FBVyxFQUFFLGVBQWU7WUFDNUIsVUFBVSxFQUFFLGNBQWM7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsY0FBYyxDQUFDLFdBQVc7WUFDakMsV0FBVyxFQUFFLDhCQUE4QjtZQUMzQyxVQUFVLEVBQUUsb0JBQW9CO1NBQ2pDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDM0MsS0FBSyxFQUFFLGNBQWMsQ0FBQyxXQUFXO1lBQ2pDLFdBQVcsRUFBRSw4QkFBOEI7WUFDM0MsVUFBVSxFQUFFLG9CQUFvQjtTQUNqQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE5SEQsOEJBOEhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xyXG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XHJcbmltcG9ydCAqIGFzIHN1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcclxuaW1wb3J0ICogYXMgbGFtYmRhRXZlbnRTb3VyY2VzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuZXhwb3J0IGNsYXNzIFdzc2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT0gRHluYW1vREIgVGFibGUgPT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IHN0dWRlbnRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1N0dWRlbnRzVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ1N0dWRlbnRzLUNESycsXHJcbiAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgIG5hbWU6ICdpZCcsXHJcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIsXHJcbiAgICAgIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIEZvciBkZW1vIHB1cnBvc2VzXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PSBTTlMgVG9waWMgPT09PT09PT09PT09PT09PT09PT1cclxuICAgIGNvbnN0IHN0dWRlbnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ1N0dWRlbnRFbnJvbGxtZW50VG9waWMnLCB7XHJcbiAgICAgIHRvcGljTmFtZTogJ1N0dWRlbnRFbnJvbGxtZW50VG9waWMtQ0RLJyxcclxuICAgICAgZGlzcGxheU5hbWU6ICdTdHVkZW50IEVucm9sbG1lbnQgRXZlbnRzIChDREspJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09IFNRUyBRdWV1ZSA9PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3Qgc3R1ZGVudFF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnU3R1ZGVudEVucm9sbG1lbnRRdWV1ZScsIHtcclxuICAgICAgcXVldWVOYW1lOiAnU3R1ZGVudEVucm9sbG1lbnRRdWV1ZS1DREsnLFxyXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDQpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT0gU05TIHRvIFNRUyBTdWJzY3JpcHRpb24gPT09PT09PT09PT09PT09PT09PT1cclxuICAgIHN0dWRlbnRUb3BpYy5hZGRTdWJzY3JpcHRpb24oXHJcbiAgICAgIG5ldyBzdWJzY3JpcHRpb25zLlNxc1N1YnNjcmlwdGlvbihzdHVkZW50UXVldWUpXHJcbiAgICApO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09IFByb2R1Y2VyIExhbWJkYSBGdW5jdGlvbiA9PT09PT09PT09PT09PT09PT09PVxyXG4gICAgY29uc3QgcHJvZHVjZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdHVkZW50QXBpRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3dzc2Utc3R1ZGVudC1hcGktY2RrJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEtcHJvZHVjZXInKSksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVEFCTEVfTkFNRTogc3R1ZGVudHNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgU05TX1RPUElDX0FSTjogc3R1ZGVudFRvcGljLnRvcGljQXJuLFxyXG4gICAgICB9LFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIFByb2R1Y2VyIExhbWJkYVxyXG4gICAgc3R1ZGVudHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocHJvZHVjZXJMYW1iZGEpO1xyXG4gICAgc3R1ZGVudFRvcGljLmdyYW50UHVibGlzaChwcm9kdWNlckxhbWJkYSk7XHJcblxyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT0gQ29uc3VtZXIgTGFtYmRhIEZ1bmN0aW9uID09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBjb25zdW1lckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0dWRlbnRDb25zdW1lckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICd3c3NlLXN0dWRlbnQtY29uc3VtZXItY2RrJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEtY29uc3VtZXInKSksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgbWVtb3J5U2l6ZTogMTI4LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gR3JhbnQgU1FTIHBlcm1pc3Npb25zIHRvIENvbnN1bWVyIExhbWJkYVxyXG4gICAgc3R1ZGVudFF1ZXVlLmdyYW50Q29uc3VtZU1lc3NhZ2VzKGNvbnN1bWVyTGFtYmRhKTtcclxuXHJcbiAgICAvLyBBZGQgU1FTIGFzIGV2ZW50IHNvdXJjZSBmb3IgQ29uc3VtZXIgTGFtYmRhXHJcbiAgICBjb25zdW1lckxhbWJkYS5hZGRFdmVudFNvdXJjZShcclxuICAgICAgbmV3IGxhbWJkYUV2ZW50U291cmNlcy5TcXNFdmVudFNvdXJjZShzdHVkZW50UXVldWUsIHtcclxuICAgICAgICBiYXRjaFNpemU6IDUsXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09IEFQSSBHYXRld2F5ID09PT09PT09PT09PT09PT09PT09XHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdTdHVkZW50QXBpJywge1xyXG4gICAgICByZXN0QXBpTmFtZTogJ1N0dWRlbnQgRW5yb2xsbWVudCBBUEkgKENESyknLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3Igc3R1ZGVudCBlbnJvbGxtZW50IHN5c3RlbSAtIGRlcGxveWVkIHZpYSBDREsnLFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XHJcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBzdHVkZW50cyA9IGFwaS5yb290LmFkZFJlc291cmNlKCdzdHVkZW50cycpO1xyXG4gICAgY29uc3Qgc3R1ZGVudEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvZHVjZXJMYW1iZGEpO1xyXG5cclxuICAgIHN0dWRlbnRzLmFkZE1ldGhvZCgnR0VUJywgc3R1ZGVudEludGVncmF0aW9uKTtcclxuICAgIHN0dWRlbnRzLmFkZE1ldGhvZCgnUE9TVCcsIHN0dWRlbnRJbnRlZ3JhdGlvbik7XHJcblxyXG4gICAgY29uc3Qgc3R1ZGVudEJ5SWQgPSBzdHVkZW50cy5hZGRSZXNvdXJjZSgne2lkfScpO1xyXG4gICAgc3R1ZGVudEJ5SWQuYWRkTWV0aG9kKCdHRVQnLCBzdHVkZW50SW50ZWdyYXRpb24pO1xyXG5cclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09IFN0YWNrIE91dHB1dHMgPT09PT09PT09PT09PT09PT09PT1cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlFbmRwb2ludCcsIHtcclxuICAgICAgdmFsdWU6IGFwaS51cmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgRW5kcG9pbnQgVVJMJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1dzc2VBcGlFbmRwb2ludCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRHluYW1vREJUYWJsZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBzdHVkZW50c1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBUYWJsZSBOYW1lJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1dzc2VEeW5hbW9EQlRhYmxlJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTTlNUb3BpY0FybicsIHtcclxuICAgICAgdmFsdWU6IHN0dWRlbnRUb3BpYy50b3BpY0FybixcclxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgVG9waWMgQVJOJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1dzc2VTTlNUb3BpYycsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU1FTUXVldWVVcmwnLCB7XHJcbiAgICAgIHZhbHVlOiBzdHVkZW50UXVldWUucXVldWVVcmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU1FTIFF1ZXVlIFVSTCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdXc3NlU1FTUXVldWUnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Byb2R1Y2VyTGFtYmRhQXJuJywge1xyXG4gICAgICB2YWx1ZTogcHJvZHVjZXJMYW1iZGEuZnVuY3Rpb25Bcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJvZHVjZXIgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdXc3NlUHJvZHVjZXJMYW1iZGEnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbnN1bWVyTGFtYmRhQXJuJywge1xyXG4gICAgICB2YWx1ZTogY29uc3VtZXJMYW1iZGEuZnVuY3Rpb25Bcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29uc3VtZXIgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdXc3NlQ29uc3VtZXJMYW1iZGEnLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==