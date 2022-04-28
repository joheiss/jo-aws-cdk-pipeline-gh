#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PipelineStack } from "../lib/pipeline-stack";
import { ServiceStack } from "../lib/service-stack";
import { BillingStack } from "../lib/billing-stack";

const app = new cdk.App();

const pipelineStack = new PipelineStack(app, "PipelineStack", {
  ownerEmail: "aws-lab@jovisco.de ",
});
const serviceStackTest = new ServiceStack(app, "ServiceStack-Test", {
  stageName: "Test",
});

const serviceStackProd = new ServiceStack(app, "ServiceStack-Prod", {
  stageName: "Prod",
});

const billingStack = new BillingStack(app, "BillingStack");

const testDeployStage = pipelineStack.addDeployStage(
  serviceStackTest,
  "Service_Deploy_Test"
);
pipelineStack.addTestToStage(
  testDeployStage,
  serviceStackTest.serviceEndpointOutput.importValue
);

const prodDeployStage = pipelineStack.addDeployStage(
  serviceStackProd,
  "Service_Deploy_Prod"
);
pipelineStack.addBillingStackToDeployStage(billingStack, prodDeployStage);
