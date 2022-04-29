import { SecretValue, Stack, StackProps } from "aws-cdk-lib";
import {
  BuildEnvironmentVariableType,
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
} from "aws-cdk-lib/aws-codebuild";
import { Artifact, IStage, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import {
  CloudFormationCreateUpdateStackAction,
  CodeBuildAction,
  CodeBuildActionType,
  GitHubSourceAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { Construct } from "constructs";
import { ServiceStack } from "./service-stack";
import { BillingStack } from "./billing-stack";
import { Topic } from "aws-cdk-lib/aws-sns";
import { SnsTopic } from "aws-cdk-lib/aws-events-targets";
import { EventField, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

interface PipelineStackProps extends StackProps {
  ownerEmail?: string;
}

export class PipelineStack extends Stack {
  private readonly pipeline: Pipeline;
  private cdkSourceOutput: Artifact;
  private serviceSourceOutput: Artifact;
  private cdkBuildOutput: Artifact;
  private serviceBuildOutput: Artifact;
  private readonly snsTopic: Topic;
  private readonly emailAddress?: string;

  constructor(scope: Construct, id: string, props?: PipelineStackProps) {
    super(scope, id, props);

    if (props?.ownerEmail && props.ownerEmail.length > 3) {
      this.emailAddress = props.ownerEmail;
      this.snsTopic = this._createSnsTopic();
    }
    this.pipeline = this._createCodePipeline();
  }

  public addDeployStage(serviceStack: ServiceStack, stageName: string): IStage {
    return this.pipeline.addStage({
      stageName,
      actions: [
        new CloudFormationCreateUpdateStackAction({
          actionName: "Service_Update",
          stackName: serviceStack.stackName,
          templatePath: this.cdkBuildOutput.atPath(
            `${serviceStack.stackName}.template.json`
          ),
          adminPermissions: true,
          parameterOverrides: {
            ...serviceStack.serviceCode.assign(
              this.serviceBuildOutput.s3Location
            ),
          },
          extraInputs: [this.serviceBuildOutput],
        }),
      ],
    });
  }

  public addTestToStage(stage: IStage, serviceEndpoint: string): void {
    const testAction = new CodeBuildAction({
      actionName: "Service_Test",
      input: this.serviceSourceOutput,
      project: new PipelineProject(this, "JoServiceTestBuildProject", {
        environment: {
          buildImage: LinuxBuildImage.STANDARD_5_0,
        },
        buildSpec: BuildSpec.fromSourceFilename(
          "buildspecs/test-buildspec.yml"
        ),
      }),
      environmentVariables: {
        SERVICE_ENDPOINT: {
          value: serviceEndpoint,
          type: BuildEnvironmentVariableType.PLAINTEXT,
        },
      },
      type: CodeBuildActionType.TEST,
      runOrder: 2,
    });
    stage.addAction(testAction);
    if (this.snsTopic) {
      testAction.onStateChange(
        "TestFailed",
        new SnsTopic(this.snsTopic, {
          message: RuleTargetInput.fromText(
            `Test failed. See details here: ${EventField.fromPath(
              "$.detail.execution-result.external-execution-url"
            )}`
          ),
        }),
        {
          ruleName: "TestFailed",
          eventPattern: {
            detail: {
              state: ["FAILED"],
            },
          },
          description: "Test has failed",
        }
      );
    }
  }

  public addBillingStackToDeployStage(
    billingStack: BillingStack,
    stage: IStage
  ): void {
    stage.addAction(
      new CloudFormationCreateUpdateStackAction({
        actionName: "BudgetWarning_Update",
        stackName: billingStack.stackName,
        templatePath: this.cdkBuildOutput.atPath(
          `${billingStack.stackName}.template.json`
        ),
        adminPermissions: true,
      })
    );
  }

  private _createSnsTopic(): Topic {
    const topic = new Topic(this, "NotifyOnFailedPipeline", {
      topicName: "NotifyOnFailedPipeline",
    });

    // topic.addSubscription(new EmailSubscription(this.emailAddress!, { json: false }));

    return topic;
  }

  private _createCodePipeline(): Pipeline {
    // create code pipeline
    const pipeline = new Pipeline(this, "JoPipeline", {
      pipelineName: "JoPipeline",
      crossAccountKeys: false,
      restartExecutionOnUpdate: true,
    });

    // add source stage
    this._addSourceStage(pipeline);

    // add build stage
    this._addBuildStage(pipeline);

    // add update stage
    this._addUpdateStage(pipeline);

    return pipeline;
  }

  private _addSourceStage(pipeline: Pipeline): void {
    // create source output artifact
    this.cdkSourceOutput = new Artifact("CdkSourceOutput");
    this.serviceSourceOutput = new Artifact("ServiceSourceOutput");

    // add source stage
    pipeline.addStage({
      stageName: "Source",
      actions: [
        new GitHubSourceAction({
          actionName: "Pipeline_Source",
          owner: "joheiss",
          repo: "jo-aws-cdk-pipeline-gh",
          branch: "main",
          oauthToken: SecretValue.secretsManager("github-token"),
          output: this.cdkSourceOutput,
        }),
        new GitHubSourceAction({
          actionName: "Service_Source",
          owner: "joheiss",
          repo: "jo-aws-express-app",
          branch: "main",
          oauthToken: SecretValue.secretsManager("github-token"),
          output: this.serviceSourceOutput,
        }),
      ],
    });
  }

  private _addBuildStage(pipeline: Pipeline): void {
    // create build output artifact
    this.cdkBuildOutput = new Artifact("CdkBuildOutput");
    this.serviceBuildOutput = new Artifact("ServiceBuildOutput");

    // add build stage
    pipeline.addStage({
      stageName: "Build",
      actions: [
        new CodeBuildAction({
          actionName: "Pipeline_Build",
          input: this.cdkSourceOutput,
          outputs: [this.cdkBuildOutput],
          project: new PipelineProject(this, "JoCdkBuildProject", {
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0,
            },
            buildSpec: BuildSpec.fromSourceFilename(
              "buildspecs/cdk-buildspec.yml"
            ),
          }),
        }),
        new CodeBuildAction({
          actionName: "Service_Build",
          input: this.serviceSourceOutput,
          outputs: [this.serviceBuildOutput],
          project: new PipelineProject(this, "JoServiceBuildProject", {
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0,
            },
            buildSpec: BuildSpec.fromSourceFilename(
              "buildspecs/service-buildspec.yml"
            ),
          }),
        }),
      ],
    });
  }

  private _addUpdateStage(pipeline: Pipeline): void {
    pipeline.addStage({
      stageName: "Update",
      actions: [
        new CloudFormationCreateUpdateStackAction({
          actionName: "Pipeline_Update",
          stackName: this.stackName,
          templatePath: this.cdkBuildOutput.atPath(
            `${this.stackName}.template.json`
          ),
          adminPermissions: true,
        }),
      ],
    });
  }
}
