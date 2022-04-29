import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Topic } from "aws-cdk-lib/aws-sns";
import { ServiceHealthCanary } from "../../lib/constructs/service-health-canary";

describe("Testing the Canary", () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, "TestStack");
  });

  test("Create canary construct successfully", () => {
    new ServiceHealthCanary(stack, "TestCanary", {
      apiEndpoint: "api.example.com",
      canaryName: "test-canary",
      alarmTopic: new Topic(stack, "TestAlarmTopic"),
    });

    Template.fromStack(stack).hasResourceProperties("AWS::Synthetics::Canary", {
      RunConfig: {
        EnvironmentVariables: {
          API_ENDPOINT: "api.example.com",
        },
      },
    });
  });
});
