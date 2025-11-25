# GitHub Actions Setup Guide - Infrastructure

This guide explains how to configure GitHub Actions to automatically deploy AWS CDK infrastructure changes.

## Prerequisites

- GitHub repository with the CDK code
- AWS account with CDK already bootstrapped
- AWS CLI installed and configured locally

## Overview

This setup includes two workflows:

1. **cdk-deploy.yml**: Automatically deploys infrastructure on push to main/master
2. **cdk-diff.yml**: Shows infrastructure changes in pull requests before merging

## Setup Steps

### 1. Create IAM OIDC Identity Provider

Set up GitHub as an OIDC identity provider in AWS:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create IAM Role for GitHub Actions

Create a trust policy file `github-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::638596943304:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME:*"
        }
      }
    }
  ]
}
```

**IMPORTANT**: Replace `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` with your actual GitHub repository path.

Create the IAM role:

```bash
aws iam create-role \
  --role-name GitHubActionsCDKDeployRole \
  --assume-role-policy-document file://github-trust-policy.json
```

### 3. Attach Administrator or PowerUser Permissions

For CDK deployments, the role needs broad permissions to create and manage AWS resources.

**Option 1: Administrator Access (Recommended for initial setup)**

```bash
aws iam attach-role-policy \
  --role-name GitHubActionsCDKDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

**Option 2: Custom Policy (More Restrictive)**

Create a custom policy `github-cdk-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "iam:*",
        "ec2:*",
        "ecs:*",
        "ecr:*",
        "elasticloadbalancing:*",
        "cognito-idp:*",
        "logs:*",
        "ssm:GetParameter",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

Apply the policy:

```bash
aws iam put-role-policy \
  --role-name GitHubActionsCDKDeployRole \
  --policy-name GitHubActionsCDKPolicy \
  --policy-document file://github-cdk-policy.json
```

### 4. Configure GitHub Repository Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add the following secret:

   - **Name**: `AWS_ROLE_TO_ASSUME`
   - **Value**: `arn:aws:iam::638596943304:role/GitHubActionsCDKDeployRole`

### 5. (Optional) Configure Environment Protection

For additional safety on production deployments:

1. Go to **Settings** > **Environments**
2. Create a new environment named "production"
3. Add protection rules:
   - Required reviewers
   - Wait timer
   - Deployment branches (main/master only)

Update the workflow to use the environment:

```yaml
jobs:
  deploy:
    environment: production
    # ... rest of the job
```

## Workflows Explained

### CDK Deploy Workflow

**File**: `.github/workflows/cdk-deploy.yml`

**Triggers**:
- Push to `main` or `master` branch
- Manual trigger via GitHub Actions UI

**Steps**:
1. Checkout code
2. Setup Node.js with caching
3. Install npm dependencies
4. Build TypeScript code
5. Run CDK tests
6. Configure AWS credentials via OIDC
7. Synthesize CDK app
8. Bootstrap CDK (if needed)
9. Deploy all stacks
10. Get stack outputs
11. Create deployment summary
12. Upload CDK outputs as artifacts

**Features**:
- Automatic CDK bootstrap
- Stack outputs in summary
- CDK artifacts saved for 30 days
- Runs tests before deployment

### CDK Diff Workflow

**File**: `.github/workflows/cdk-diff.yml`

**Triggers**:
- Pull requests to `main` or `master`
- Only when CDK files are modified

**Steps**:
1. Checkout PR code
2. Setup Node.js
3. Build and test
4. Configure AWS credentials
5. Synthesize CDK app
6. Generate diff against deployed stacks
7. Comment diff on PR
8. Check for destructive changes
9. Upload diff as artifact

**Features**:
- Shows changes before merge
- Warns about destructive changes
- Automatic PR comments
- No actual deployment

## Testing the Workflows

### Test CDK Deploy (Manual)

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **CDK Deploy Infrastructure**
4. Click **Run workflow**
5. Select branch and click **Run workflow**

### Test CDK Deploy (Automatic)

Push a change to main/master:

```bash
# Make a change to CDK code
vim lib/infrastructure-stack.ts

# Commit and push
git add .
git commit -m "Update infrastructure"
git push origin main
```

### Test CDK Diff

Create a pull request:

```bash
# Create feature branch
git checkout -b feature/update-infrastructure

# Make changes
vim lib/ecs-stack.ts

# Commit and push
git add .
git commit -m "Increase ECS task memory"
git push origin feature/update-infrastructure

# Create PR on GitHub
```

The workflow will automatically comment on the PR with the CDK diff.

## Monitoring Deployments

### In GitHub

- **Actions** tab shows all workflow runs
- Click on a run to see detailed logs
- View step-by-step execution
- Download artifacts (CDK outputs, diffs)

### In AWS CloudFormation Console

- View stack events in real-time
- Check stack outputs
- Review resource changes
- Monitor rollback status

### Via AWS CLI

```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name InfrastructureStack \
  --region us-east-2

# View stack events
aws cloudformation describe-stack-events \
  --stack-name InfrastructureStack \
  --region us-east-2 \
  --max-items 20

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name InfrastructureStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs'
```

## Security Best Practices

1. **Use OIDC instead of long-lived credentials**: No AWS access keys stored in GitHub
2. **Least privilege IAM permissions**: Start broad, then narrow down based on actual usage
3. **Repository-specific trust policy**: Role can only be assumed by your specific repository
4. **Enable branch protection**: Require PR reviews before merging to main/master
5. **Use environment protection**: Add manual approval for production deployments
6. **Audit workflow runs**: Regularly review Actions logs
7. **Rotate credentials**: OIDC tokens are short-lived and auto-rotated

## Troubleshooting

### Issue: "No basic auth credentials"

**Solution**: Verify OIDC provider exists and trust policy is correct.

```bash
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::638596943304:oidc-provider/token.actions.githubusercontent.com
```

### Issue: "User is not authorized to perform: cloudformation:CreateStack"

**Solution**: Ensure the IAM role has sufficient CloudFormation permissions.

### Issue: "CDK Bootstrap required"

**Solution**: The workflow automatically runs bootstrap. If it fails, manually bootstrap:

```bash
cdk bootstrap aws://638596943304/us-east-2
```

### Issue: "Stack is in UPDATE_ROLLBACK_FAILED state"

**Solution**: You may need to manually fix the stack:

```bash
# Continue update rollback
aws cloudformation continue-update-rollback \
  --stack-name InfrastructureStack \
  --region us-east-2

# Or delete and redeploy
aws cloudformation delete-stack \
  --stack-name InfrastructureStack \
  --region us-east-2
```

### Issue: Workflow timeout

**Solution**: Large deployments may take time. You can increase timeout:

```yaml
jobs:
  deploy:
    timeout-minutes: 60  # Default is 360 (6 hours)
```

### Issue: CDK diff fails with access denied

**Solution**: Diff requires read permissions. Ensure role can:
- Describe CloudFormation stacks
- Read S3 CDK assets
- Get SSM parameters

## Best Practices

### 1. Use Pull Requests

Always create PRs for infrastructure changes:
- Review CDK diff before merge
- Get team approval
- Catch potential issues early

### 2. Test Locally First

Before pushing, test locally:

```bash
npm run build
npm test
cdk synth
cdk diff
```

### 3. Small, Incremental Changes

- Deploy one change at a time
- Easier to troubleshoot
- Faster rollback if needed

### 4. Monitor Deployments

- Watch CloudFormation events during deployment
- Check CloudWatch logs for errors
- Verify stack outputs after deployment

### 5. Use CDK Context

Store environment-specific values in `cdk.context.json`:

```json
{
  "production": {
    "cpu": 1024,
    "memory": 2048
  },
  "staging": {
    "cpu": 512,
    "memory": 1024
  }
}
```

### 6. Version Control CDK Outputs

Save the synthesized CloudFormation templates:

```bash
cdk synth --output cdk.out
git add cdk.out
```

## Rolling Back

If a deployment causes issues:

### Option 1: Revert Git Commit

```bash
git revert HEAD
git push origin main
# Workflow will automatically deploy previous version
```

### Option 2: Manual Rollback via AWS

```bash
# Get previous stack template
aws cloudformation get-template \
  --stack-name InfrastructureStack \
  --template-stage Original \
  --region us-east-2

# Update stack with previous template
aws cloudformation update-stack \
  --stack-name InfrastructureStack \
  --template-body file://previous-template.json \
  --region us-east-2
```

### Option 3: Redeploy from Local

```bash
git checkout <previous-commit>
cdk deploy --all
```

## Advanced: Multi-Environment Setup

For multiple environments (dev, staging, prod):

1. Create separate branches: `dev`, `staging`, `main`
2. Create separate AWS accounts or regions
3. Update workflow to deploy based on branch:

```yaml
jobs:
  deploy:
    steps:
      - name: Set environment
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "ENV=production" >> $GITHUB_ENV
            echo "AWS_REGION=us-east-1" >> $GITHUB_ENV
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "ENV=staging" >> $GITHUB_ENV
            echo "AWS_REGION=us-east-2" >> $GITHUB_ENV
          else
            echo "ENV=dev" >> $GITHUB_ENV
            echo "AWS_REGION=us-west-2" >> $GITHUB_ENV
          fi
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK GitHub Actions](https://github.com/aws/aws-cdk/tree/main/.github/workflows)
- [Configuring OpenID Connect in AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html)
