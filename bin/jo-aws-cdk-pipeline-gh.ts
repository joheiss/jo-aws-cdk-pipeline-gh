#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { ServiceStack } from '../lib/service-stack';
import { BillingStack } from '../lib/billing-stack';

const app = new cdk.App();

const pipelineStack = new PipelineStack(app, 'PipelineStack', {});
const serviceStack = new ServiceStack(app, 'ServiceStack');
const billingStack = new BillingStack(app, 'BillingStack');

const deplayStage = pipelineStack.addDeployStage(serviceStack, 'Service_Deploy');
pipelineStack.addBillingStackToDeployStage(billingStack, deplayStage);
