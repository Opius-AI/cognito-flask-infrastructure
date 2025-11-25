import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface EcrStackProps extends cdk.StackProps {
  readonly repositoryName?: string;
}

export class EcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;
  public readonly repositoryUri: string;
  public readonly repositoryArn: string;

  constructor(scope: Construct, id: string, props?: EcrStackProps) {
    super(scope, id, props);

    // Create ECR Repository
    this.repository = new ecr.Repository(this, 'FlaskAuthRepository', {
      repositoryName: props?.repositoryName || 'flask-auth-app',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
        {
          description: 'Remove untagged images after 1 day',
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test only
      emptyOnDelete: true,
    });

    this.repositoryUri = this.repository.repositoryUri;
    this.repositoryArn = this.repository.repositoryArn;

    // Outputs
    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: 'EcrRepositoryUri',
    });

    new cdk.CfnOutput(this, 'RepositoryArn', {
      value: this.repository.repositoryArn,
      description: 'ECR Repository ARN',
      exportName: 'EcrRepositoryArn',
    });

    new cdk.CfnOutput(this, 'RepositoryName', {
      value: this.repository.repositoryName,
      description: 'ECR Repository Name',
      exportName: 'EcrRepositoryName',
    });

    // Docker commands for reference
    new cdk.CfnOutput(this, 'DockerLoginCommand', {
      value: `aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${this.repository.repositoryUri}`,
      description: 'Docker login command',
    });

    new cdk.CfnOutput(this, 'DockerBuildPushCommands', {
      value: `docker build -t ${this.repository.repositoryName} ../frontend && docker tag ${this.repository.repositoryName}:latest ${this.repository.repositoryUri}:latest && docker push ${this.repository.repositoryUri}:latest`,
      description: 'Docker build and push commands',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'FlaskAuthApp');
    cdk.Tags.of(this).add('Environment', 'Development');
  }
}
