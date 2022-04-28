import { Construct } from "constructs";
import { StackProps } from 'aws-cdk-lib';
import { CfnBudget } from "aws-cdk-lib/aws-budgets";

interface BudgetProps extends StackProps {
    name: string;
    limitAmount?: number;
    limitCurrency?: string;
    snsTopicArn?: string;
}

enum BudgetType {
    COST = 'COST',
    RI_COVERAGE = 'RI_COVERAGE',
    RI_UTILIZATION = 'RI_UTILIZATION',
    SAVINGS_PLANS_COVERAGE = 'SAVINGS_PLANS_COVERAGE',
    SAVINGS_PLANS_UTILIZATION = 'SAVINGS_PLANS_UTILIZATION',
    USAGE= 'USAGE',
}

enum TimeUnit {
    ANNUALLY = 'ANNUALLY',
    DAILY = 'DAILY',
    MONTHLY = 'MONTHLY',
    QUARTERLY = 'QUARTERLY',
}

export class CostBudgetWarning extends Construct {
    constructor(scope: Construct, id: string, props: BudgetProps) {
        super(scope, id);

        // prepare for notifications - if requested
        const notificationsWithSubscribers = this.buildNotificationsWithSubscribers(props);

        const budget = new CfnBudget(this, 'my-Budget', {
            budget: {
                budgetName: props.name,
                budgetLimit: {
                    amount: props?.limitAmount ?? 10,
                    unit: props?.limitCurrency ?? 'USD',
                },
                budgetType: BudgetType.COST,
                timeUnit: TimeUnit.MONTHLY,
            },
            notificationsWithSubscribers,
        });
    }

    private buildNotificationsWithSubscribers(props: BudgetProps): any {

        let notificationsWithSubscribers = undefined;

        if (props.snsTopicArn) {
            notificationsWithSubscribers = [];
            notificationsWithSubscribers.push({
                notification: {
                    notificationType: 'ACTUAL',
                    comparisonOperator: 'GREATER_THAN',
                    threshold: 100,
                    thresholdType: 'PERCENTAGE',
                },
                subscribers: [
                    { 
                        subscriptionType: 'SNS', 
                        address: props.snsTopicArn 
                    }
                ]

            });
        }

        return notificationsWithSubscribers;
    }
}