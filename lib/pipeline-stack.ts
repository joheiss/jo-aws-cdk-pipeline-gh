import { SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, GitHubSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';

export class PipelineStack extends Stack {
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

    // create source output artifact
    const sourceOutput = new Artifact('SourceOutput');

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
          output: sourceOutput,
        }),
      ]
    });

    // create build output artifact
    const buildOutput = new Artifact('BuildOutput');

    // add build stage
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new CodeBuildAction({
          actionName: 'Pipeline_Build',
          input: sourceOutput,
          outputs: [
            buildOutput,
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

    return pipeline;
  }
}
