#!/bin/bash

TARGET_GROUP_ARN="arn:aws:elasticloadbalancing:us-east-1:587928088166:targetgroup/mcp-mainstage-target/0b0eb0deec1a0324"
REGION="us-east-1"

echo "========================================="
echo "Checking Target Group Health"
echo "========================================="
echo ""

# 1. Check target health
echo "1. Target Health Status:"
aws elbv2 describe-target-health \
  --target-group-arn "$TARGET_GROUP_ARN" \
  --region "$REGION"

echo ""
echo "========================================="
echo "2. Target Group Configuration:"
echo "========================================="
aws elbv2 describe-target-groups \
  --target-group-arns "$TARGET_GROUP_ARN" \
  --region "$REGION" \
  --query 'TargetGroups[0].{HealthCheckPath:HealthCheckPath,HealthCheckPort:HealthCheckPort,HealthCheckProtocol:HealthCheckProtocol,HealthCheckIntervalSeconds:HealthCheckIntervalSeconds,HealthCheckTimeoutSeconds:HealthCheckTimeoutSeconds,HealthyThresholdCount:HealthyThresholdCount,UnhealthyThresholdCount:UnhealthyThresholdCount,Matcher:Matcher}'

echo ""
echo "========================================="
echo "3. Getting Load Balancer DNS:"
echo "========================================="
LB_ARN=$(aws elbv2 describe-target-groups \
  --target-group-arns "$TARGET_GROUP_ARN" \
  --region "$REGION" \
  --query 'TargetGroups[0].LoadBalancerArns[0]' \
  --output text)

if [ "$LB_ARN" != "None" ]; then
    LB_INFO=$(aws elbv2 describe-load-balancers \
      --load-balancer-arns "$LB_ARN" \
      --region "$REGION")
    
    LB_DNS=$(echo "$LB_INFO" | jq -r '.LoadBalancers[0].DNSName')
    LB_STATE=$(echo "$LB_INFO" | jq -r '.LoadBalancers[0].State.Code')
    
    echo "Load Balancer DNS: $LB_DNS"
    echo "Load Balancer State: $LB_STATE"
    echo ""
    echo "🔗 Health Check URL: http://$LB_DNS/health"
    
    echo ""
    echo "========================================="
    echo "4. Testing Health Endpoint:"
    echo "========================================="
    echo "Testing with curl (10 second timeout)..."
    curl -v --max-time 10 "http://$LB_DNS/health"
    
    echo ""
    echo ""
    echo "========================================="
    echo "5. Load Balancer Listeners:"
    echo "========================================="
    aws elbv2 describe-listeners \
      --load-balancer-arn "$LB_ARN" \
      --region "$REGION" \
      --query 'Listeners[*].{Port:Port,Protocol:Protocol,DefaultActions:DefaultActions[0].Type}'
fi

echo ""
echo "========================================="
echo "6. Security Group for ECS Tasks:"
echo "========================================="
echo "Security Group: sg-0dbfbfe70bbd61192"
aws ec2 describe-security-groups \
  --group-ids sg-0dbfbfe70bbd61192 \
  --region "$REGION" \
  --query 'SecurityGroups[0].{GroupName:GroupName,InboundRules:IpPermissions[*].[IpProtocol,FromPort,ToPort,IpRanges[0].CidrIp]}'