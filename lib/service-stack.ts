import { HttpApi } from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import { Statistic, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import {
  LambdaDeploymentConfig,
  LambdaDeploymentGroup,
} from "aws-cdk-lib/aws-codedeploy";
import {
  Alias,
  Architecture,
  CfnParametersCode,
  Code,
  Function,
  Runtime,
} from "aws-cdk-lib/aws-lambda";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";
import { ServiceHealthCanary } from "./constructs/service-health-canary";

interface ServiceStackProps extends StackProps {
  stageName: string;
}
export class ServiceStack extends Stack {
  public readonly serviceCode: CfnParametersCode;
  public readonly serviceEndpointOutput: CfnOutput;
  private readonly alias: Alias;
  private readonly api: HttpApi;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    this.serviceCode = Code.fromCfnParameters();

    // create lambda function - typescript
    const lambdaFn = new Function(this, "LambdaFunction", {
      architecture: Architecture.ARM_64,
      memorySize: 128,
      timeout: Duration.seconds(3),
      runtime: Runtime.NODEJS_14_X,
      handler: "src/lambda.handler",
      code: this.serviceCode,
      functionName: `ServiceLambda${props.stageName}`,
      description: `generated on ${new Date().toISOString()}`, // make sure a change is re-deployed on every CDK build
    });

    // create a lambda alias
    this.alias = new Alias(this, "ServiceLambdaAlias", {
      version: lambdaFn.currentVersion,
      aliasName: `ServiceLambdaAlias${props.stageName}`,
    });

    // create HTTP API
    this.api = new HttpApi(this, "ServiceApi", {
      defaultIntegration: new HttpLambdaIntegration(
        "LambdaIntegration",
        this.alias
      ),
      apiName: `JoService${props.stageName}`,
    });

    // create Lambda Deployment Group - for Prod stage only
    if (props.stageName === "Prod") {
      this._createLambdaDeploymentGroup(props.stageName);
      const alarmTopic = new Topic(this, "ServiceAlarmTopic", {
        topicName: "ServiceAlarmTopic",
      });
      alarmTopic.addSubscription(new EmailSubscription("aws-lab@jovisco.de"));
      this._createServiceHealthCanary(alarmTopic);
    }

    // create Output for API endpoint
    this.serviceEndpointOutput = new CfnOutput(this, "ApiEndPointOutput", {
      exportName: `JoServiceEndpoint${props.stageName}`,
      value: this.api.apiEndpoint,
      description: "API Endpoint",
    });
  }

  private _createLambdaDeploymentGroup(stageName: string): void {
    new LambdaDeploymentGroup(this, "DeploymentGroup", {
      alias: this.alias,
      deploymentConfig: LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
      autoRollback: {
        deploymentInAlarm: true,
      },
      alarms: [
        this.api
          .metricServerError()
          .with({
            period: Duration.minutes(1),
            statistic: Statistic.SUM,
          })
          .createAlarm(this, "ServiceErrorAlarm", {
            threshold: 1,
            alarmDescription: "Service is experiencing errors",
            alarmName: `ServiceErrorAlarm${stageName}`,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
          }),
      ],
    });
  }

  private _createServiceHealthCanary(alarmTopic: Topic): void {
    new ServiceHealthCanary(this, "ServiceHealthCanary", {
      apiEndpoint: this.api.apiEndpoint,
      canaryName: "service-canary",
      alarmTopic,
    });
  }
}
