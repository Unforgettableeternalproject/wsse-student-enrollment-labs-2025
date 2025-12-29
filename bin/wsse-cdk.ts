#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WsseStack } from '../lib/wsse-stack';

const app = new cdk.App();

new WsseStack(app, 'WsseStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '434824683139',
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
  },
  description: 'WSSE Student Enrollment System - CDK Deployment',
});

app.synth();
