#!/bin/bash

# -----------------------------------------------------------------------------
# REPLICATION SCRIPT FOR LOAD BALANCER
# This script runs in the SOURCE account to copy a LB to the TARGET account.
# -----------------------------------------------------------------------------

# PART 1: Get the configuration from the SOURCE account (where the original LB is)
echo "📖 Reading configuration from SOURCE account..."
EXISTING_LB_ARN=$(aws elbv2 describe-load-balancers --names ratemyroommatesserver --query 'LoadBalancers[0].LoadBalancerArn' --output text)

if [ "$EXISTING_LB_ARN" == "None" ]; then
    echo "❌ ERROR: Load balancer 'ratemyroommatesserver' not found in the source account."
    exit 1
fi

echo "Found Load Balancer ARN: $EXISTING_LB_ARN"

# PART 2: Assume the role to get access to the TARGET account (693211791810)
echo "🔑 Assuming role in TARGET account..."
CREDENTIALS=$(aws sts assume-role \
    --role-arn "arn:aws:iam::693211791810:role/SourceAccount-LB-Replication-Access" \
    --role-session-name "LB-Replication-Script")

# Check if assume-role was successful
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to assume role in target account. Check the role ARN and permissions."
    exit 1
fi

# Extract the temporary credentials for the TARGET account
export AWS_ACCESS_KEY_ID=$(echo $CREDENTIALS | jq -r .Credentials.AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo $CREDENTIALS | jq -r .Credentials.SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo $CREDENTIALS | jq -r .Credentials.SessionToken)

# PART 3: Create the new Load Balancer in the TARGET account
echo "🏗️ Creating new load balancer in TARGET account (693211791810)..."
aws elbv2 create-load-balancer \
    --name ratemyroommatesserver-replica \
    --subnets subnet-094dddd662f95f567 subnet-0fc836f8618073d1c \
    --security-groups sg-00457eeb14a69b5f0 \
    --scheme internet-facing \
    --type application \
    --region us-east-1

# Check if LB creation was successful
if [ $? -eq 0 ]; then
    echo "✅ Success! The new load balancer 'ratemyroommatesserver-replica' is being created in the TARGET account."
else
    echo "❌ ERROR: Failed to create load balancer in target account. Check subnet and security group IDs."
fi

# Optional: Clean up environment variables if you plan to do more work in the same shell session
# unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN