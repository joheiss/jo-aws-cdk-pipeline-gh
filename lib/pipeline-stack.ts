import { SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CloudFormationCreateUpdateStackAction, CodeBuildAction, GitHubSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';

export class PipelineStack extends Stack {
  private cdkSourceOutput: Artifact;
  private serviceSourceOutput: Artifact;
  private cdkBuildOutput: Artifact;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = this._createCodePipeline();
  }


  private _createCodePipeline(): Pipeline {
    
    // create code pipeline
    const pipeline = new Pipeline(this, 'Pipeline', {
      pipelineName: 'Pipeline',
      crossAccountKeys: false,
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
    this.cdkSourceOutput = new Artifact('CdkSourceOutput');
    this.serviceSourceOutput = new Artifact('ServiceSourceOutput');

    // add source stage
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new GitHubSourceAction({
          actionName: 'Pipeline_Source',
          owner: 'joheiss',
          repo: 'jo-aws-cdk-pipeline-gh',
          branch: 'main',
          oauthToken: SecretValue.secretsManager('github-token'),
          output: this.cdkSourceOutput,
        }),
        new GitHubSourceAction({
          actionName: 'Service_Source',
          owner: 'joheiss',
          repo: 'jo-aws-express-app',
          branch: 'main',
          oauthToken: SecretValue.secretsManager('github-token'),
          output: this.serviceSourceOutput,
        }),

      ]
    });    
  }

  private _addBuildStage(pipeline: Pipeline): void {

    // create build output artifact
    this.cdkBuildOutput = new Artifact('CdkBuildOutput');

    // add build stage
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new CodeBuildAction({
          actionName: 'Pipeline_Build',
          input: this.cdkSourceOutput,
          outputs: [
            this.cdkBuildOutput,
          ],
          project: new PipelineProject(this, 'BuildProject', {
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0,
            },
            buildSpec: BuildSpec.fromSourceFilename('buildspecs/buildspec.yml'),
          }),
        }),
      ]
    });
  }

  private _addUpdateStage(pipeline: Pipeline): void {

    pipeline.addStage({
      stageName: 'Update',
      actions: [
        new CloudFormationCreateUpdateStackAction({
          actionName: 'Pipeline_Update',
          stackName: 'PipelineStack',
          templatePath: this.cdkBuildOutput.atPath('PipelineStack.template.json'),
          adminPermissions: true,
        })
      ]
    });
  }
}
