# Lab 2 Submission

## Repository Link

[WSSE Student Enrollment Labs 2025](https://github.com/Unforgettableeternalproject/wsse-student-enrollment-labs-2025)

## Pull Request Link

[PR #2: Lab 2 Implementation - Cognito Integration](https://github.com/Unforgettableeternalproject/wsse-student-enrollment-labs-2025/pull/3)

## Screenshots

### Cognito User Pool Configuration

![Cognito User Pool](images/lab02/01-cognito-pool.png)

### Cognito Domain Settings

![Cognito Domain](images/lab02/02-cognito-domain.png)

### Cognito App Client Configuration

![Cognito App Client](images/lab02/03-cognito-appclient.png)

### Cognito Scopes Setup

![Cognito Scopes](images/lab02/04-cognito-scopes.png)

### JWT Access Token Claims

![JWT Access Claims](images/lab02/05-jwt-access-claims.png)

### Swagger Editor - No Errors

![Swagger Editor](images/lab02/06-editor-no-errors.png)

### PR Green Light

![PR Green Light](images/lab02/07-pr-green.png)

## Key Snippets from openapi.yaml

### Security Schemes

#### Cognito OAuth2 Security Scheme

```yaml
components:
  securitySchemes:
    CognitoOAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: "https://ap-southeast-2mr6mvb05j.auth.ap-southeast-2.amazoncognito.com"
          tokenUrl: "https://ap-southeast-2mr6mvb05j.auth.ap-southeast-2.amazoncognito.com/oauth2/token"
          scopes:
            students.read: "Read access to student information"
            students.write: "Write access to student information"
```
