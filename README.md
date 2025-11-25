# Cognito Flask Infrastructure

AWS CDK infrastructure for deploying the Flask authentication application with AWS Cognito, ECR, and ECS Fargate.

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                         VPC                              │
                    │  ┌─────────────────┐       ┌─────────────────────────┐  │
Internet ──────────►│  │  Public Subnet  │       │    Private Subnet       │  │
                    │  │      (ALB)      │──────►│   (ECS Fargate Tasks)   │  │
                    │  └─────────────────┘       └───────────┬─────────────┘  │
                    │                                        │                │
                    └────────────────────────────────────────┼────────────────┘
                                                             │
                              ┌───────────────┬──────────────┴──────────────┐
                              │               │                             │
                              ▼               ▼                             ▼
                        ┌──────────┐   ┌──────────┐                  ┌──────────┐
                        │ Cognito  │   │   ECR    │                  │CloudWatch│
                        │User Pool │   │Repository│                  │  Logs    │
                        └──────────┘   └──────────┘                  └──────────┘
```

## Stacks

| Stack | Description |
|-------|-------------|
| `CognitoStack` | AWS Cognito User Pool and App Client for authentication |
| `EcrStack` | ECR repository for Docker images |
| `EcsStack` | VPC, ECS Cluster, Fargate Service, and Application Load Balancer |

## Features

- **Cognito User Pool**: Email-based authentication with password policies
- **ECR Repository**: Private Docker image storage with lifecycle policies
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: HTTP traffic distribution with health checks
- **Auto Scaling**: CPU and memory-based scaling (1-10 tasks)
- **CloudWatch Logs**: Centralized logging with 7-day retention
- **VPC**: Isolated networking with public/private subnets

## Prerequisites

- Node.js 18+
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Bootstrap CDK (first time only):
   ```bash
   cdk bootstrap
   ```

3. Deploy all stacks:
   ```bash
   cdk deploy --all
   ```

   Or use the deploy script:
   ```bash
   ./scripts/deploy.sh
   ```

## Project Structure

```
infrastructure/
├── bin/                        # CDK app entry point
├── lib/
│   ├── cognito-stack.ts        # Cognito User Pool
│   ├── ecr-stack.ts            # ECR Repository
│   ├── ecs-stack.ts            # ECS Fargate Service
│   └── infrastructure-stack.ts # Main orchestrator
├── scripts/
│   ├── deploy.sh               # Full deployment script
│   └── build-and-push.sh       # Docker build and push
└── test/                       # Unit tests
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch for changes and compile |
| `npm run test` | Run Jest unit tests |
| `cdk deploy --all` | Deploy all stacks to AWS |
| `cdk diff` | Compare deployed stack with current state |
| `cdk synth` | Emit synthesized CloudFormation template |
| `cdk destroy --all` | Remove all stacks |

## Stack Outputs

After deployment, you'll receive:

- **CognitoUserPoolId**: User Pool ID for authentication
- **CognitoClientId**: App Client ID for the frontend
- **EcrRepositoryUri**: ECR repository URI for pushing images
- **LoadBalancerUrl**: Application URL

### Retrieve Client Secret

```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id <pool-id> \
  --client-id <client-id> \
  --query 'UserPoolClient.ClientSecret' \
  --output text
```

## Configuration

### ECS Task Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `cpu` | 512 | CPU units (512 = 0.5 vCPU) |
| `memoryLimitMiB` | 1024 | Memory in MiB |
| `containerPort` | 8000 | Container port |
| `desiredCount` | 1 | Initial task count |

### Auto Scaling

- **Min capacity**: 1 task
- **Max capacity**: 10 tasks
- **CPU target**: 70% utilization
- **Memory target**: 80% utilization

## Deploying Application Updates

After pushing a new Docker image to ECR:

```bash
aws ecs update-service \
  --cluster flask-auth-cluster \
  --service <service-name> \
  --force-new-deployment \
  --region us-east-2
```

## Monitoring

- **Logs**: `/ecs/flask-auth-app` CloudWatch Log Group
- **Metrics**: ECS, ALB, and target health in CloudWatch
- **Alarms**: Configure for CPU, memory, and error rates

## Cleanup

To destroy all resources:

```bash
cdk destroy --all
```

**Warning**: This deletes all resources including Cognito users and Docker images.

## Related Repositories

- [cognito-flask-frontend](https://github.com/Opius-AI/cognito-flask-frontend) - Flask application code

## License

MIT
