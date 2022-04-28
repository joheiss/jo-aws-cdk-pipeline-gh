import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { CostBudgetWarning } from "../../lib/constructs/budget-construct";

describe('Monthly Cost Budget Warning', () => {

    let app: App;
    let stack: Stack;

    beforeAll(() => {
       app = new App();
        stack = new Stack(app, 'Stack');
    });

    test('Budget warning has been created', () => {

        const budget = new CostBudgetWarning(stack, 'test-BudgetWarning', {
            name: 'test-BudgetWarning',
            limitAmount: 9.99,
        });

        Template.fromStack(stack).hasResourceProperties('AWS::Budgets::Budget', {
            Budget: {
                BudgetName: 'test-BudgetWarning',
                BudgetLimit: {
                    Amount: 9.99,
                }
            }
        });
    
    });

});