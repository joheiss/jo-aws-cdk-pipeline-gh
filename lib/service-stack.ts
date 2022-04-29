import { HttpApi } from "@aws-cdk/aws-apigatewayv2-alpha";
import { ApiBase } from "@aws-cdk/aws-apigatewayv2-alpha/lib/common/base";
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
import { Construct } from "constructs";

interface ServiceStackProps extends StackProps {
  stageName: string;
}
export class ServiceStack extends Stack {
  public readonly serviceCode: CfnParametersCode;
  public readonly serviceEndpointOutput: CfnOutput;

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
    const alias = new Alias(this, "ServiceLambdaAlias", {
      version: lambdaFn.currentVersion,
      aliasName: `ServiceLambdaAlias${props.stageName}`,
    });

    // create HTTP API
    const api = new HttpApi(this, "ServiceApi", {
      defaultIntegration: new HttpLambdaIntegration("LambdaIntegration", alias),
      apiName: `JoService${props.stageName}`,
    });

    // create Lambda Deployment Group - for Prod stage only
    if (props.stageName === "Prod") {
      new LambdaDeploymentGroup(this, "DeploymentGroup", {
        alias: alias,
        deploymentConfig: LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
        autoRollback: {
          deploymentInAlarm: true,
        },
        alarms: [
          api
            .metricServerError()
            .with({
              period: Duration.minutes(1),
              statistic: Statistic.SUM,
            })
            .createAlarm(this, "ServiceErrorAlarm", {
              threshold: 1,
              alarmDescription: "Service is experiencing errors",
              alarmName: `ServiceErrorAlarm${props.stageName}`,
              evaluationPeriods: 1,
              treatMissingData: TreatMissingData.NOT_BREACHING,
            }),
        ],
      });
    }

    // create Output for API endpoint
    this.serviceEndpointOutput = new CfnOutput(this, "ApiEndPointOutput", {
      exportName: `JoServiceEndpoint${props.stageName}`,
      value: api.apiEndpoint,
      description: "API Endpoint",
    });
  }
}
