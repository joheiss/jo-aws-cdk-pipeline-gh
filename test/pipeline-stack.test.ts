import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { PipelineStack } from '../lib/pipeline-stack';

describe('Pipeline Stack', () => {

    let app: App;
    let stack: PipelineStack;
    
    beforeAll(() => {
        app = new App();
        stack = new PipelineStack(app, 'PipelineStack');
    });

    test('Stack', () => {
        const cfn = Template.fromStack(stack).toJSON();
        expect(cfn).toMatchSnapshot();
    });
});