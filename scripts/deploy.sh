#!/bin/bash

# CDK Deployment Script for Flask Auth App
set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Flask Auth App - CDK Deployment${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Please run: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

echo -e "${GREEN}✓ AWS Account: ${ACCOUNT_ID}${NC}"
echo -e "${GREEN}✓ AWS Region: ${REGION}${NC}\n"

# Bootstrap CDK (if needed)
echo -e "${BLUE}Checking CDK bootstrap...${NC}"
cdk bootstrap aws://${ACCOUNT_ID}/${REGION}
echo -e "${GREEN}✓ CDK bootstrap complete${NC}\n"

# Build TypeScript
echo -e "${BLUE}Building CDK app...${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}\n"

# Synthesize CloudFormation template
echo -e "${BLUE}Synthesizing CloudFormation template...${NC}"
cdk synth
echo -e "${GREEN}✓ Synthesis complete${NC}\n"

# Deploy
echo -e "${BLUE}Deploying infrastructure...${NC}"
cdk deploy --all --require-approval never

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Retrieve Cognito Client Secret from AWS Console or CLI"
echo -e "2. Build and push Docker image to ECR"
echo -e "3. Update ECS service"
echo -e "\n${BLUE}View outputs:${NC}"
echo -e "${YELLOW}cdk outputs${NC}\n"
