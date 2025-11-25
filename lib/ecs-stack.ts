import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  readonly ecrRepository: ecr.IRepository;
  readonly cognitoUserPoolId: string;
  readonly cognitoClientId: string;
  readonly containerPort?: number;
  readonly cpu?: number;
  readonly memoryLimitMiB?: number;
}

export class EcsStack extends cdk.Stack {
  public readonly service: ecs_patterns.ApplicationLoadBalancedFargateService;
  public readonly cluster: ecs.Cluster;
  public readonly loadBalancerUrl: string;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const containerPort = props.containerPort || 8000;
    const cpu = props.cpu || 512;
    const memoryLimitMiB = props.memoryLimitMiB || 1024;

    // Create VPC
    const vpc = new ec2.Vpc(this, 'FlaskAuthVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'FlaskAuthCluster', {
      vpc,
      clusterName: 'flask-auth-cluster',
      containerInsights: true,
    });

    // Create Task Execution Role
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Create Task Role (for the application)
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant Cognito permissions to task role
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:InitiateAuth',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminInitiateAuth',
      ],
      resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${props.cognitoUserPoolId}`],
    }));

    // Create CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'FlaskAuthLogGroup', {
      logGroupName: '/ecs/flask-auth-app',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Fargate Service with ALB
    this.service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'FlaskAuthService', {
      cluster: this.cluster,
      cpu,
      memoryLimitMiB,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(props.ecrRepository, 'latest'),
        containerPort,
        environment: {
          FLASK_APP: 'app.py',
          FLASK_DEBUG: 'False',
          COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
          COGNITO_CLIENT_ID: props.cognitoClientId,
          AWS_REGION: this.region,
        },
        secrets: {
          // Client secret should be stored in Secrets Manager or SSM Parameter Store
          // For now, we'll document how to add it manually
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'flask-auth',
          logGroup,
        }),
        executionRole,
        taskRole,
      },
      publicLoadBalancer: true,
      listenerPort: 80,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Configure health check
    this.service.targetGroup.configureHealthCheck({
      path: '/health',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Configure autoscaling
    const scalableTarget = this.service.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    this.loadBalancerUrl = this.service.loadBalancer.loadBalancerDnsName;

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerUrl', {
      value: `http://${this.service.loadBalancer.loadBalancerDnsName}`,
      description: 'Application Load Balancer URL',
      exportName: 'LoadBalancerUrl',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: 'EcsClusterName',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.service.service.serviceName,
      description: 'ECS Service Name',
      exportName: 'EcsServiceName',
    });

    new cdk.CfnOutput(this, 'TaskDefinitionArn', {
      value: this.service.taskDefinition.taskDefinitionArn,
      description: 'Task Definition ARN',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'FlaskAuthApp');
    cdk.Tags.of(this).add('Environment', 'Development');
  }
}
