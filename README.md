# Infrastructure - AWS CDK

This directory contains AWS CDK infrastructure code to deploy the Flask Authentication application with AWS Cognito, ECR, and ECS Fargate.

## Architecture

The infrastructure consists of three main stacks:

### 1. **Cognito Stack** (`cognito-stack.ts`)
- AWS Cognito User Pool with email-based authentication
- User Pool Client configured for USER_PASSWORD_AUTH flow
- Password policy enforcement
- Email verification enabled

### 2. **ECR Stack** (`ecr-stack.ts`)
- Elastic Container Registry for Docker images
- Image scanning on push
- Lifecycle policies to manage image retention
- Automatic cleanup of untagged images

### 3. **ECS Stack** (`ecs-stack.ts`)
- ECS Fargate cluster
- Application Load Balancer
- Auto-scaling based on CPU and memory
- CloudWatch logging
- VPC with public and private subnets
- IAM roles with least privilege access

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure AWS
```bash
aws configure
```

### 3. Bootstrap CDK (first time only)
```bash
cdk bootstrap
```

### 4. Deploy Infrastructure
```bash
./scripts/deploy.sh
```

### 5. Build and Push Docker Image
```bash
./scripts/build-and-push.sh
```

## Useful CDK Commands

* `npm run build`   - Compile TypeScript to JavaScript
* `npm run watch`   - Watch for changes and compile
* `npm run test`    - Run Jest unit tests
* `cdk deploy --all` - Deploy all stacks to AWS
* `cdk diff`        - Compare deployed stack with current state
* `cdk synth`       - Emit synthesized CloudFormation template
* `cdk destroy --all` - Destroy all stacks (cleanup)

## Project Structure

```
infrastructure/
├── bin/                   # CDK app entry point
├── lib/                   # Stack definitions
│   ├── cognito-stack.ts  # Cognito User Pool
│   ├── ecr-stack.ts      # ECR Repository
│   ├── ecs-stack.ts      # ECS Fargate Service
│   └── infrastructure-stack.ts  # Main orchestrator
├── scripts/              # Deployment scripts
└── test/                 # Unit tests
```

## Deployment Steps

1. **Deploy CDK Infrastructure**
   ```bash
   cd infrastructure
   ./scripts/deploy.sh
   ```

2. **Get CDK Outputs**
   - Cognito User Pool ID
   - Cognito Client ID
   - ECR Repository URI
   - Load Balancer URL

3. **Retrieve Client Secret**
   ```bash
   aws cognito-idp describe-user-pool-client \
     --user-pool-id <pool-id> \
     --client-id <client-id> \
     --query 'UserPoolClient.ClientSecret' \
     --output text
   ```

4. **Build and Push Docker Image**
   ```bash
   ./scripts/build-and-push.sh
   ```

5. **Access Application**
   - Open the Load Balancer URL from CDK outputs

## Configuration

Edit `lib/infrastructure-stack.ts` to customize:
- User Pool name
- ECR repository name
- ECS task CPU/memory
- Container port
- Auto-scaling settings

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
