import { Stack, StackProps } from 'aws-cdk-lib';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { CostBudgetWarning } from './constructs/budget-construct';

export class BillingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // create SNS topic for budget warning
    const topic =  new Topic(this, 'MonthlyCostBudgetWarningTopic', {
      displayName: 'Monthly Cost Budget Warning Topic',
      topicName: 'MonthlyCostBudgetWarningTopic',
  });

    // create budget warning 
    const budgetWarning = new CostBudgetWarning(this, 'Budget-Warning', {
      name: 'MonthlyCostBudgetWarning',
      limitAmount: 10,
      snsTopicArn: topic.topicArn,
    });

  }
}
