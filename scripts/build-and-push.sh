#!/bin/bash

# Docker Build and Push Script for Flask Auth App
set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Flask Auth App - Docker Build & Push${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}
REPOSITORY_NAME=${ECR_REPOSITORY:-flask-auth-app}
IMAGE_TAG=${IMAGE_TAG:-latest}

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}"

echo -e "${GREEN}✓ AWS Account: ${ACCOUNT_ID}${NC}"
echo -e "${GREEN}✓ AWS Region: ${REGION}${NC}"
echo -e "${GREEN}✓ Repository: ${REPOSITORY_NAME}${NC}"
echo -e "${GREEN}✓ Image Tag: ${IMAGE_TAG}${NC}\n"

# Login to ECR
echo -e "${BLUE}Logging in to ECR...${NC}"
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
echo -e "${GREEN}✓ Logged in to ECR${NC}\n"

# Build Docker image
echo -e "${BLUE}Building Docker image...${NC}"
cd ../frontend
docker build -t ${REPOSITORY_NAME}:${IMAGE_TAG} .
echo -e "${GREEN}✓ Docker image built${NC}\n"

# Tag image for ECR
echo -e "${BLUE}Tagging image for ECR...${NC}"
docker tag ${REPOSITORY_NAME}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}
echo -e "${GREEN}✓ Image tagged${NC}\n"

# Push to ECR
echo -e "${BLUE}Pushing image to ECR...${NC}"
docker push ${ECR_URI}:${IMAGE_TAG}
echo -e "${GREEN}✓ Image pushed to ECR${NC}\n"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build and Push Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Image URI:${NC}"
echo -e "${YELLOW}${ECR_URI}:${IMAGE_TAG}${NC}\n"

echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Update ECS service to use new image"
echo -e "2. Wait for service to reach stable state"
echo -e "\n${BLUE}Update ECS service:${NC}"
echo -e "${YELLOW}aws ecs update-service --cluster flask-auth-cluster --service <service-name> --force-new-deployment --region ${REGION}${NC}\n"
