import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { BillingStack } from "../lib/billing-stack";

describe('Monthly Cost Budget Warning Stack', () => {

    let app: App;
    let stack: BillingStack;
    
    beforeEach(() => {
        app = new App();
        stack = new BillingStack(app, 'MontlyCostBudgetWarningStack');
    });

    test('Stack', () => {
        const cfn = Template.fromStack(stack).toJSON();
        expect(cfn).toMatchSnapshot();
    });
});