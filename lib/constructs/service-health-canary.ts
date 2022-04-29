import { CfnCanary } from "aws-cdk-lib/aws-synthetics";
import * as synthetics from "@aws-cdk/aws-synthetics-alpha";
import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as path from "path";
import * as fs from "fs";
import { Statistic, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Topic } from "aws-cdk-lib/aws-sns";

interface ServiceHealthCanaryProps {
  apiEndpoint: string;
  canaryName: string;
  alarmTopic: Topic;
}

export class ServiceHealthCanary extends Construct {
  constructor(scope: Construct, id: string, props: ServiceHealthCanaryProps) {
    super(scope, id);

    const canary = new synthetics.Canary(this, props.canaryName, {
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_1,
      canaryName: props.canaryName,
      schedule: synthetics.Schedule.rate(Duration.minutes(1)),
      test: synthetics.Test.custom({
        code: synthetics.Code.fromInline(
          fs.readFileSync(
            path.join(__dirname, "../../lambda/canary.ts"),
            "utf8"
          )
        ),
        handler: "index.handler",
      }),
      environmentVariables: {
        API_ENDPOINT: props.apiEndpoint,
        DEPLOYMENT_TRIGGER: Date.now().toString(), // make sure canary is re-deployed by Cloudformation
      },
      timeToLive: Duration.minutes(5),
    });

    // create canary metric
    const metricFailed = canary.metricFailed({
        period: Duration.minutes(1),
        statistic: Statistic.SUM,
        label: `${props.canaryName} failed`
    });

    // create alarm
    const canaryFailedAlarm = metricFailed.createAlarm(this, `${props.canaryName}FailedAlarm`, {
        threshold: 1,
        alarmDescription: `ServiceHealthCanary "${props.canaryName}" failed`,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.NOT_BREACHING,
        alarmName: `${props.canaryName}FailedAlarm`,
    });

    // add action to alarm
    canaryFailedAlarm.addAlarmAction(new SnsAction(props.alarmTopic));
  }
}
