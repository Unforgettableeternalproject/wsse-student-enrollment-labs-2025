import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
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
