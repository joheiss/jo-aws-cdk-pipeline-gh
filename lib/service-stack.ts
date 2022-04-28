import { HttpApi } from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpLambdaIntegration} from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Architecture, CfnParametersCode, Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

interface ServiceStackProps extends StackProps {
    stageName: string;
}
export class ServiceStack extends Stack {
    public readonly serviceCode: CfnParametersCode;

    constructor(scope: Construct, id: string, props: ServiceStackProps) {
        super(scope, id, props);

        this.serviceCode = Code.fromCfnParameters();

        // create lambda function - typescript
        const lambdaFn = new Function(this, 'LambdaFunction', {
            architecture: Architecture.ARM_64,
            memorySize: 128,
            timeout: Duration.seconds(3),
            runtime: Runtime.NODEJS_14_X,
            handler: 'src/lambda.handler',
            code: this.serviceCode,
            functionName: `ServiceLambda${props.stageName}`,
        });
                
        // create HTTP API
        new HttpApi(this, 'ServiceApi', {
            defaultIntegration: new HttpLambdaIntegration('LambdaIntegration', lambdaFn),
            apiName: `MyService${props.stageName}`,
        });
    }
}