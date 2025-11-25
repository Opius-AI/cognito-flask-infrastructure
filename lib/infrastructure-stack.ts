import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CognitoStack } from './cognito-stack';
import { EcrStack } from './ecr-stack';
import { EcsStack } from './ecs-stack';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito Stack
    const cognitoStack = new CognitoStack(this, 'CognitoStack', {
      userPoolName: 'flask-auth-pool',
      appClientName: 'flask-auth-client',
    });

    // Create ECR Stack
    const ecrStack = new EcrStack(this, 'EcrStack', {
      repositoryName: 'flask-auth-app',
    });

    // Create ECS Stack (depends on Cognito and ECR)
    const ecsStack = new EcsStack(this, 'EcsStack', {
      ecrRepository: ecrStack.repository,
      cognitoUserPoolId: cognitoStack.userPoolId,
      cognitoClientId: cognitoStack.userPoolClientId,
      containerPort: 8000,
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    // Add dependencies
    ecsStack.addDependency(cognitoStack);
    ecsStack.addDependency(ecrStack);

    // Overall stack outputs
    new cdk.CfnOutput(this, 'ApplicationUrl', {
      value: `http://${ecsStack.loadBalancerUrl}`,
      description: 'Flask Authentication Application URL',
    });

    new cdk.CfnOutput(this, 'DeploymentInstructions', {
      value: [
        '1. Build and push Docker image to ECR',
        '2. Update ECS service to use new image',
        '3. Configure Cognito client secret in application',
      ].join(' | '),
      description: 'Deployment Steps',
    });
  }
}
