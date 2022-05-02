import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { IStage } from "aws-cdk-lib/aws-codepipeline";
import { PipelineStack } from "../lib/pipeline-stack";
import { ServiceStack } from "../lib/service-stack";
import { BillingStack } from "../lib/billing-stack";

const testEnv = {
  account: '123456789',
  region: 'us-east-1'
};

describe("Pipeline Stack", () => {
  let app: App;
  let stack: PipelineStack;

  beforeEach(() => {
    app = new App();
    stack = new PipelineStack(app, "PipelineStack", {
      env: testEnv,
      ownerEmail: "test@test.de",
    });
  });

  test("Stack", () => {
    const cfn = Template.fromStack(stack).toJSON();
    expect(cfn).toMatchSnapshot();
  });

  describe("Deployment Stage", () => {
    let serviceStack: ServiceStack;
    let stage: IStage;

    beforeEach(() => {
      serviceStack = new ServiceStack(app, "ServiceStack", {
        env: testEnv,
        stageName: "Test",
      });
      stage = stack.addDeployStage(serviceStack, "Deploy");
    });

    test("Add service stage", () => {
      // GIVEN & WHEN -- see beforeEach
      // THEN
      Template.fromStack(stack).hasResourceProperties(
        "AWS::CodePipeline::Pipeline",
        {
          Stages: Match.arrayWith([Match.objectLike({ Name: "Deploy" })]),
        }
      );
    });

    test("Add billing stack to deploy stage", () => {
      // GIVEN & WHEN -- see beforeEach
      // WHEN
      const billingStack = new BillingStack(app, "BillingStack");
      stack.addBillingStackToDeployStage(billingStack, stage);
      // THEN
      Template.fromStack(stack).hasResourceProperties(
        "AWS::CodePipeline::Pipeline",
        {
          Stages: Match.arrayWith([
            Match.objectLike({
              Actions: Match.arrayWith([
                Match.objectLike({ Name: "BudgetWarning_Update" }),
              ]),
            }),
          ]),
        }
      );
    });
  });
});
