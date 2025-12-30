[![中文](https://img.shields.io/badge/中文-README-blue)](README_zh_tw.md)

# WSSE Student Enrollment System

## Overview

WSSE Student Enrollment System is a full-stack server application developed as a learning project for the Web Service Software Engineering course. This project implements OpenAPI specifications to build a student enrollment system with robust security and authorization features. It serves as a comprehensive example of modern web service development, incorporating RESTful APIs, authentication, and authorization mechanisms.

## Features

* **OpenAPI Specification**: Complete API documentation using OpenAPI 3.0 for student enrollment operations
* **Authentication & Authorization**: AWS Cognito integration with OAuth2 for secure user management
* **Serverless Architecture**: AWS Lambda functions for scalable API endpoints
* **NoSQL Database**: DynamoDB for high-performance student data persistence
* **Event-Driven Processing**: SNS & SQS integration for asynchronous workflows
* **Infrastructure as Code**: AWS CDK for automated infrastructure deployment
* **Observability**: CloudWatch Logs, Metrics, Alarms, Dashboard & X-Ray distributed tracing
* **CDN & Static Hosting**: CloudFront + S3 for global content delivery
* **CI/CD Pipeline**: GitHub Actions with OIDC authentication for automated deployments
* **API Documentation**: Interactive Swagger UI for API exploration and testing

## Screenshots

Screenshots for each lab implementation are available in the `images/` directory:
- Lab 01: OpenAPI Specification (`images/lab01/`)
- Lab 02: Cognito Authentication (`images/lab02/`)
- Lab 03-05: Lambda, DynamoDB, SNS/SQS Integration
- Lab 06: CDK Infrastructure (`images/lab06/`)
- Lab 07: CloudWatch Observability (`images/lab07/`)
- Lab 08: CloudFront Frontend Hosting (`images/lab08/`)
- Lab 09: Enterprise Security (`images/lab09/`)

## Architecture

This project implements a modern serverless architecture on AWS:

```
User → CloudFront → API Gateway → Lambda (Producer) → DynamoDB
                                      ↓
                                    SNS Topic
                                      ↓
                                   SQS Queue
                                      ↓
                              Lambda (Consumer)
```

**Key Components**:
- **Frontend**: S3 + CloudFront for static website hosting
- **API Layer**: API Gateway + Lambda functions (Node.js 18.x)
- **Data Storage**: DynamoDB (Students table)
- **Event Processing**: SNS/SQS for asynchronous student enrollment events
- **Monitoring**: CloudWatch + X-Ray for observability
- **Infrastructure**: AWS CDK (TypeScript) for IaC

## Deployment

### Prerequisites
- AWS Account with appropriate permissions
- AWS CLI configured
- Node.js 18.x or later
- AWS CDK CLI (`npm install -g aws-cdk`)

### Deploy via CDK

1. **Clone the repository**:
   ```bash
   git clone https://github.com/unforgettableeternalproject/wsse-student-enrollment-labs-2025
   cd wsse-student-enrollment-labs-2025
   ```

2. **Install CDK dependencies**:
   ```bash
   npm install
   ```

3. **Deploy infrastructure**:
   API Endpoints

### Student Management

```
GET    /students           - List all students
POST   /students           - Create new student
GET    /students/{id}      - Get student by ID
PUT    /students/{id}      - Update student
DELETE /students/{id}      - Delete student
```

### System Endpoints

```
GET    /health            - Health check (no auth required)
```

### Authentication

Authentication is handled via AWS Cognito:
1. Obtain access token from Cognito User Pool
2. Include token in `Authorization` header: `Bearer <token>`
3. Tokens are validated by API Gateway authorizer

For detailed API documentation, see `openapi/openapi.yaml` or visit the Swagger UI
- Push to `main` branch triggers automatic deployment
- Uses OIDC for secure AWS authentication
- Automatically deploys CDK stack changes

## Usage

### Authentication

 - TO-DO

### Student Enrollment

 - TO-DO

### API Documentation

Access the interactive API documentation at `/api-docs` to explore all available endpoints, test requests, and view response schemas.

## Project Structure

```
wsse-student-enrollment-labs-2025/
├── openapi/
│   └── openapi.yaml                 # OpenAPI 3.0 specification
├── lambda-producer/
│   └── index.mjs                    # Producer Lambda (API handler)
├── lambda-consumer/
│   └── index.mjs                    # Consumer Lambda (Event processor)
├── lib/
│   └── wsse-stack.ts                # CDK Stack definition
├── bin/
│   └── wsse-cdk.ts                  # CDK app entry point
├── frontend/
│   ├── index.html                   # Static website
│   └── image.jpg                    # Demo image
├── .github/
│   └── workflows/
│       ├── openapi-validation.yml   # OpenAPI spec validation
│       └── cdk-deploy.yml           # CDK deployment workflow
├── submissions/                      # Lab submission documents
│   ├── lab01-submission.md
│   ├── lab02-submission.md
│   ├── lab06-submission.md
│   ├── lab07-submission.md
│   ├── lab08-submission.md
│   └── lab09-submission.md
└── images/                          # Lab screenshots
    ├── lab01/, lab02/, lab03/
    ├── lab06/, lab07/, lab08/
    └── lab09/
```

## Monitoring & Observability

The system includes comprehensive observability features:

- **CloudWatch Logs**: 7-day retention for Lambda execution logs
- **CloudWatch Metrics**: Custom metrics for API calls, errors, latency
- **CloudWatch Alarms**: 4 alarms monitoring system health
  - Producer Lambda errors (≥3 in 5 min)
  - Producer Lambda duration (>5000ms)
  - Consumer Lambda errors (≥3 in 5 min)
  - DynamoDB throttling (≥5 in 5 min)
- **CloudWatch Dashboard**: Real-time visualization of system metrics
- **X-Ray Tracing**: Distributed tracing for request flows

## Lab Progression

This project evolved through completing the following labs:

- **Lab 1** ✅: OpenAPI Specification - RESTful API definition using OpenAPI 3.0 and Swagger validation
- **Lab 2** ✅: AWS Cognito - OAuth2 authentication and user pool integration
- **Lab 3** ✅: Lambda Functions - Serverless API endpoint implementation
- **Lab 4** ✅: DynamoDB - NoSQL database integration for student data persistence
- **Lab 5** ✅: SNS/SQS - Event-driven architecture with asynchronous message processing
- **Lab 6** ✅: AWS CDK - Infrastructure as Code for automated deployment automation
- **Lab 7** ✅: Observability - CloudWatch Logs, Metrics, Alarms, Dashboard & X-Ray tracing
- **Lab 8** ✅: Frontend Hosting - CloudFront CDN + S3 static website hosting
- **Lab 9** ✅: Enterprise Security - Encryption validation (DynamoDB/S3), Lambda environment variables for secrets management, execution testing

## To-Do List

- [ ] Implement OAuth2 integration for third-party authentication
- [ ] Add rate limiting and API throttling
- [ ] Implement comprehensive unit and integration tests
- [ ] Add API versioning support
- [ ] Implement caching layer for improved performance
- [ ] Add real-time notifications for enrollment updates
- [ ] Enhance error handling and validation
- [ ] Add API analytics and monitoring dashboard

## Contributing

This is a course project for learning purposes. Contributions are welcome for educational enhancement. Please follow the course guidelines and submit pull requests for review.

## License

This project is for educational purposes as part of the Web Service Software Engineering course.

## Contact

For questions or suggestions related to this course project, please contact the course instructor or teaching assistant.

[![Static Badge](https://img.shields.io/badge/course-WSSE-blue)](mailto:course@example.com)