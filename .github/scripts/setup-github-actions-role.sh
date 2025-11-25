#!/bin/bash

# Setup IAM Role for GitHub Actions CDK Deployments
set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GitHub Actions CDK IAM Role Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-2}

echo -e "${GREEN}✓ AWS Account: ${ACCOUNT_ID}${NC}"
echo -e "${GREEN}✓ AWS Region: ${REGION}${NC}\n"

# Prompt for GitHub repository
read -p "Enter your GitHub repository (format: username/repo-name): " GITHUB_REPO

if [ -z "$GITHUB_REPO" ]; then
    echo -e "${RED}Error: GitHub repository is required${NC}"
    exit 1
fi

# Ask for permission level
echo -e "\n${YELLOW}Choose permission level:${NC}"
echo "1) AdministratorAccess (Recommended for initial setup)"
echo "2) Custom CDK Policy (More restrictive)"
read -p "Enter choice (1 or 2): " PERMISSION_CHOICE

echo -e "\n${BLUE}Creating OIDC Identity Provider...${NC}"

# Check if OIDC provider already exists
OIDC_PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN" &> /dev/null; then
    echo -e "${YELLOW}OIDC provider already exists${NC}"
else
    aws iam create-open-id-connect-provider \
      --url https://token.actions.githubusercontent.com \
      --client-id-list sts.amazonaws.com \
      --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
      > /dev/null
    echo -e "${GREEN}✓ OIDC provider created${NC}"
fi

# Create trust policy
echo -e "\n${BLUE}Creating IAM trust policy...${NC}"
cat > /tmp/github-cdk-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

# Create IAM role
echo -e "${BLUE}Creating IAM role...${NC}"
ROLE_NAME="GitHubActionsCDKDeployRole"

if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo -e "${YELLOW}Role already exists, updating trust policy...${NC}"
    aws iam update-assume-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-document file:///tmp/github-cdk-trust-policy.json
else
    aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document file:///tmp/github-cdk-trust-policy.json \
      > /dev/null
    echo -e "${GREEN}✓ IAM role created${NC}"
fi

# Attach permissions based on choice
echo -e "\n${BLUE}Attaching permissions policy...${NC}"

if [ "$PERMISSION_CHOICE" == "1" ]; then
    # AdministratorAccess
    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
    echo -e "${GREEN}✓ AdministratorAccess policy attached${NC}"
    echo -e "${YELLOW}Note: This gives full AWS access. Consider narrowing permissions after testing.${NC}"
else
    # Custom CDK policy
    cat > /tmp/github-cdk-permissions-policy.json << EOF
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
        "sts:GetCallerIdentity",
        "apigateway:*",
        "lambda:*",
        "dynamodb:*",
        "events:*",
        "sns:*",
        "sqs:*",
        "secretsmanager:*",
        "kms:*",
        "route53:*",
        "acm:*",
        "cloudwatch:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

    aws iam put-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-name GitHubActionsCDKPolicy \
      --policy-document file:///tmp/github-cdk-permissions-policy.json
    echo -e "${GREEN}✓ Custom CDK policy attached${NC}"
fi

# Clean up temp files
rm /tmp/github-cdk-trust-policy.json
[ -f /tmp/github-cdk-permissions-policy.json ] && rm /tmp/github-cdk-permissions-policy.json

# Get role ARN
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Next Steps:${NC}\n"
echo -e "1. Add the following secret to your GitHub repository:"
echo -e "   ${YELLOW}Settings > Secrets and variables > Actions > New repository secret${NC}\n"
echo -e "   Name: ${GREEN}AWS_ROLE_TO_ASSUME${NC}"
echo -e "   Value: ${GREEN}${ROLE_ARN}${NC}\n"
echo -e "2. Push code to main/master branch or manually trigger the workflow\n"
echo -e "3. Review the workflow runs in the Actions tab\n"

echo -e "${BLUE}Useful Commands:${NC}\n"
echo -e "Test IAM role:"
echo -e "${YELLOW}aws sts get-caller-identity${NC}\n"
echo -e "View role details:"
echo -e "${YELLOW}aws iam get-role --role-name ${ROLE_NAME}${NC}\n"
echo -e "List attached policies:"
echo -e "${YELLOW}aws iam list-attached-role-policies --role-name ${ROLE_NAME}${NC}\n"
echo -e "CDK bootstrap (if not done):"
echo -e "${YELLOW}cdk bootstrap aws://${ACCOUNT_ID}/${REGION}${NC}\n"
