#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PipelineStack } from "../lib/pipeline-stack";
import { ServiceStack } from "../lib/service-stack";
import { BillingStack } from "../lib/billing-stack";
import { Environment } from "aws-cdk-lib";

const mainEnv: Environment = {
  account: '119350408617',
  region: 'eu-central-1'
};

const backupEnv: Environment = {
  account: '119350408617',
  region: 'us-east-1'
};

const sandboxAccountEnv = {
  account: '716917798878',
  region: 'eu-central-1'
};

const app = new cdk.App();

const pipelineStack = new PipelineStack(app, "JoPipelineStack", {
  env: mainEnv,
  ownerEmail: "aws-lab@jovisco.de",
});
const serviceStackTest = new ServiceStack(app, "JoServiceStack-Test", {
  env: mainEnv,
  stageName: "Test",
});

const serviceStackSandboxAccountTest = new ServiceStack(app, "JoServiceStackSandbox-Test", {
  env: sandboxAccountEnv,
  stageName: "Test",
});

const serviceStackProd = new ServiceStack(app, "JoServiceStack-Prod", {
  env: mainEnv,
  stageName: "Prod",
});

const billingStack = new BillingStack(app, "JoBillingStack");

// backup stack in different region
const serviceStackBackupProd = new ServiceStack(app, "JoServiceStackBackup-Prod", {
  env: backupEnv,
  stageName: "Prod",
});

const testDeployStage = pipelineStack.addDeployStage(
  serviceStackTest,
  "Service_Deploy_Test"
);
// this step is BAD - it's producing a circular reference to the service stack :-(
pipelineStack.addTestToStage(
  testDeployStage,
  serviceStackTest.serviceEndpointOutput.importValue
);

const prodDeployStage = pipelineStack.addDeployStage(
  serviceStackProd,
  "Service_Deploy_Prod"
);
pipelineStack.addBillingStackToDeployStage(billingStack, prodDeployStage);

// new stage for backup environment
pipelineStack.addDeployStage(
  serviceStackBackupProd,
  "Service_Backup_Prod"
);

// new stage for sandbox account
pipelineStack.addDeployStage(
  serviceStackSandboxAccountTest,
  "Service_CrossAccount_Test"
)