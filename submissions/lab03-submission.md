# Lab 03 Submission - Serverless Backend Implementation

## Student Information
- **Student Name**: [Your Name]
- **Date**: 2025-12-29
- **Lab**: Lab 03 - AWS Lambda + API Gateway Integration

## Overview
本次 Lab 完成了 Student Enrollment API 的 serverless 後端實作，包括：
- 建立 AWS Lambda 函數處理 API 請求
- 配置 API Gateway 並整合 Lambda (AWS_PROXY)
- 整合 Cognito User Pool Authorizer
- 實作健康檢查和學生資料的 CRUD 操作
- 設定 CORS 和 OAuth2 scopes

## Architecture
```
Client Request
    ↓
API Gateway (https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod)
    ↓
Cognito Authorizer (for /students endpoints)
    ↓
Lambda Function (wsse-student-api)
    ↓
In-Memory Storage (students array)
```

## Implementation Details

### 1. Lambda Function
- **Function Name**: `wsse-student-api`
- **Runtime**: Node.js 22.x
- **Handler**: index.handler
- **Region**: ap-southeast-2

### 2. API Gateway
- **API Name**: Student Enrollment API
- **API ID**: 46nqxizqc2
- **Stage**: prod
- **Invoke URL**: https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod

### 3. Endpoints Implemented

#### GET /health
- **Authorization**: None
- **Description**: Health check endpoint
- **Response**: `{"status": "ok"}`

#### GET /students
- **Authorization**: Cognito OAuth2 (students.read scope)
- **Description**: Retrieve all students
- **Response**: Array of student objects

#### POST /students
- **Authorization**: Cognito OAuth2 (students.write scope)
- **Description**: Create a new student
- **Request Body**: `{"name": "string"}`
- **Response**: Created student object with Location header

### 4. Cognito Integration
- **User Pool ID**: ap-southeast-2_MR6MVb05j
- **Authorizer Name**: CognitoOAuth2
- **Scopes**:
  - `https://api.example.edu/students.read` - Read access
  - `https://api.example.edu/students.write` - Write access

## Testing Results

### Test 1: GET /health (No Authentication Required)

```bash
curl -X GET "https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod/health" -i
```

**Output:**
```
HTTP/1.1 200 OK
Date: Sun, 28 Dec 2025 19:43:57 GMT
Content-Type: application/json
Content-Length: 15
Connection: keep-alive
x-amzn-RequestId: 788ae285-7221-40da-8d3d-28bff857f980
Access-Control-Allow-Origin: *
x-amz-apigw-id: WUJDtEzGywMEMRQ=
X-Amzn-Trace-Id: Root=1-6951887d-1ca26e3f671fff444c4b8d8c;Parent=2bfe4e9619a25efa;Sampled=0;Lineage=1:1c599a54:0

{"status":"ok"}
```

✅ **Result**: Successfully returns 200 OK with health status

---

### Test 2: GET /students (With Authentication)

```bash
# First, obtain access token from Cognito
TOKEN="<your-cognito-access-token>"

curl -X GET "https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod/students" \
  -H "Authorization: Bearer $TOKEN" \
  -i
```

**Output:**
```
HTTP/1.1 200 OK
Date: Sun, 28 Dec 2025 19:46:37 GMT
Content-Type: application/json
Content-Length: 2
Connection: keep-alive
x-amzn-RequestId: 05ba8351-1b6b-4820-be02-9654fdb88c1a
Access-Control-Allow-Origin: *
x-amz-apigw-id: WUJctFUdywMEJWg=
X-Amzn-Trace-Id: Root=1-6951891d-67716e8150ee61b77e0c4eb1;Parent=3ed3b53a86fc12f3;Sampled=0;Lineage=1:1c599a54:0

[]
```

✅ **Result**: Successfully returns 200 OK with empty array (no students yet)

---

### Test 3: POST /students (With Authentication)

```bash
curl -X POST "https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob Chen"}' \
  -i
```

**Output:**
```
HTTP/1.1 201 Created
Date: Sun, 28 Dec 2025 19:46:56 GMT
Content-Type: application/json
Content-Length: 26
Connection: keep-alive
x-amzn-RequestId: 1fe649c2-e126-4ac2-b921-b34d6d742fc1
Access-Control-Allow-Origin: *
x-amz-apigw-id: WUJfkHY-ywMEN3A=
Location: /students/1
X-Amzn-Trace-Id: Root=1-69518930-116c9c3626fbc2f2673f50c1;Parent=5225b77ddcde7a5a;Sampled=0;Lineage=1:1c599a54:0

{"id":1,"name":"Bob Chen"}
```

✅ **Result**: Successfully returns 201 Created with Location header `/students/1`

---

### Test 4: Unauthorized Request (No Token)

```bash
curl -X GET "https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod/students" -i
```

**Output:**
```
HTTP/1.1 401 Unauthorized
{"message":"Unauthorized"}
```

✅ **Result**: Correctly rejects requests without valid authorization

## Configuration Screenshots

### 1. API Resources
![API Resources](../images/lab03/api-resources.png)
- Shows `/health` and `/students` resources with their methods (GET, POST, OPTIONS)

### 2. Lambda Integration - GET /students
![GET /students Integration](../images/lab03/integration-get-students.png)
- Integration Type: AWS_PROXY
- Lambda Function: wsse-student-api

### 3. Lambda Integration - POST /students
![POST /students Integration](../images/lab03/integration-post-students.png)
- Integration Type: AWS_PROXY
- Lambda Function: wsse-student-api

### 4. Lambda Integration - GET /health
![GET /health Integration](../images/lab03/integration-health.png)
- Integration Type: AWS_PROXY
- Lambda Function: wsse-student-api

### 5. CORS Configuration
![CORS Settings](../images/lab03/cors-students.png)
- OPTIONS method enabled for /students
- Access-Control-Allow-Origin: *

### 6. API Gateway Stage
![Stage Configuration](../images/lab03/stage-prod.png)
- Stage Name: prod
- Deployment ID: 8ub3sk
- Invoke URL: https://46nqxizqc2.execute-api.ap-southeast-2.amazonaws.com/prod

### 7. Cognito Authorizer
![Authorizer Configuration](../images/lab03/authorizer.png)
- Name: CognitoOAuth2
- Type: COGNITO_USER_POOLS
- User Pool: ap-southeast-2_MR6MVb05j

### 8. Method Request Scopes - GET
![GET Scopes](../images/lab03/scope-get.png)
- Authorization: COGNITO_USER_POOLS
- OAuth Scopes: students.read

### 9. Method Request Scopes - POST
![POST Scopes](../images/lab03/scope-post.png)
- Authorization: COGNITO_USER_POOLS
- OAuth Scopes: students.write

### 10. Lambda Test - Health Check
![Lambda Test Health](../images/lab03/lambda-test-health.png)
- Test Event: GET /health
- Response: 200 OK with `{"status":"ok"}`

### 11. Lambda Test - Create Student
![Lambda Test POST](../images/lab03/lambda-test-post.png)
- Test Event: POST /students
- Response: 201 Created with Location header

### 12. CloudWatch Logs
![CloudWatch Logs](../images/lab03/logs.png)
- Shows RequestId, httpMethod, path, and request body
- Example RequestId: 1fe649c2-e126-4ac2-b921-b34d6d742fc1

## Lambda Function Code

The Lambda function is implemented in Node.js 22.x and stored in `lambda/index.mjs`:

**Key Features:**
- Handles three endpoints: `/health`, `GET /students`, `POST /students`
- Returns appropriate HTTP status codes (200, 201, 400, 404, 500)
- Includes CORS headers
- Validates input for POST requests
- Returns Location header for created resources
- Logs all events to CloudWatch

## Verification Checklist

- [x] API Gateway resources created (`/health`, `/students`)
- [x] Lambda function deployed and accessible
- [x] All endpoints use AWS_PROXY integration
- [x] Cognito Authorizer configured
- [x] OAuth2 scopes properly set
- [x] CORS enabled on `/students`
- [x] GET /health returns 200 without auth
- [x] GET /students requires valid token
- [x] POST /students requires valid token and returns 201 + Location
- [x] Unauthorized requests return 401
- [x] CloudWatch Logs capture all requests

## Challenges and Solutions

### Challenge 1: Integration Type
**Problem**: Initial setup used `AWS` integration type instead of `AWS_PROXY`  
**Solution**: Updated all integrations to use `AWS_PROXY` for proper request/response passthrough

### Challenge 2: Health Endpoint Authorization
**Problem**: `/health` endpoint incorrectly required Cognito authorization  
**Solution**: Changed authorization type to `NONE` for the health check endpoint

### Challenge 3: Location Header
**Problem**: POST response didn't include Location header  
**Solution**: Added Location header to Lambda response: `Location: /students/${newStudent.id}`

## Conclusion

Successfully implemented a serverless Student Enrollment API using AWS Lambda and API Gateway with the following achievements:

1. ✅ Created and deployed Lambda function with proper business logic
2. ✅ Configured API Gateway with AWS_PROXY integration
3. ✅ Integrated Cognito User Pool for OAuth2 authentication
4. ✅ Implemented proper error handling and validation
5. ✅ Set up CORS for cross-origin requests
6. ✅ All endpoints tested and verified working correctly
7. ✅ CloudWatch logging enabled for monitoring and debugging

The API is now fully functional and ready for frontend integration.

## Next Steps

- [ ] Implement DynamoDB for persistent storage
- [ ] Add individual student retrieval (GET /students/{id})
- [ ] Add update and delete operations
- [ ] Implement input validation with JSON Schema
- [ ] Add comprehensive error handling
- [ ] Set up CI/CD pipeline for automated deployment
