import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface CognitoStackProps extends cdk.StackProps {
  readonly userPoolName?: string;
  readonly appClientName?: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props?: CognitoStackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'FlaskAuthUserPool', {
      userPoolName: props?.userPoolName || 'flask-auth-pool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test only
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'FlaskAuthUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: props?.appClientName || 'flask-auth-client',
      generateSecret: true,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.minutes(60),
      idTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Store User Pool ID
    this.userPoolId = this.userPool.userPoolId;
    this.userPoolClientId = this.userPoolClient.userPoolClientId;

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'CognitoUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: 'CognitoUserPoolArn',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'CognitoUserPoolClientId',
    });

    // Note: Client secret must be retrieved via AWS CLI or Console
    new cdk.CfnOutput(this, 'GetClientSecretCommand', {
      value: `aws cognito-idp describe-user-pool-client --user-pool-id ${this.userPool.userPoolId} --client-id ${this.userPoolClient.userPoolClientId} --query 'UserPoolClient.ClientSecret' --output text`,
      description: 'Command to retrieve User Pool Client Secret',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'FlaskAuthApp');
    cdk.Tags.of(this).add('Environment', 'Development');
  }
}
