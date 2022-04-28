import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { PipelineStack } from '../lib/pipeline-stack';
import { ServiceStack } from '../lib/service-stack';

describe('Pipeline Stack', () => {

    let app: App;
    let stack: PipelineStack;
    
    beforeEach(() => {
        app = new App();
        stack = new PipelineStack(app, 'PipelineStack');
    });

    test('Stack', () => {
        const cfn = Template.fromStack(stack).toJSON();
        expect(cfn).toMatchSnapshot();
    });

    test('Add service stage', () => {
        // GIVEN
        const serviceStack = new ServiceStack(app, 'ServiceStack');
        // WHEN
        stack.addDeployStage(serviceStack, 'Deploy');
        // THEN
        Template.fromStack(stack).hasResourceProperties('AWS::CodePipeline::Pipeline', {
            Stages: Match.arrayWith([
                Match.objectLike({ Name: "Deploy" }),
            ]),
        });
    });
});