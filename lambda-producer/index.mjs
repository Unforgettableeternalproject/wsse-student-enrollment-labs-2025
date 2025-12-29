import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const ddbClient = new DynamoDBClient({ region: "ap-southeast-2" });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({ region: "ap-southeast-2" });

const TABLE_NAME = process.env.TABLE_NAME || "Students";
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  const path = event.path || event.resource;
  const method = event.httpMethod;

  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };

  try {
    // Health check endpoint (no auth required)
    if (path === "/health" && method === "GET") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: "ok" })
      };
    }

    // GET /students - List all students with pagination
    if (path === "/students" && method === "GET") {
      const nextCursor = event.queryStringParameters?.nextCursor;
      
      const params = {
        TableName: TABLE_NAME
      };

      // Handle pagination
      if (nextCursor) {
        try {
          params.ExclusiveStartKey = JSON.parse(
            Buffer.from(nextCursor, 'base64').toString('utf-8')
          );
        } catch (error) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              type: "https://httpstatuses.com/400",
              title: "Invalid nextCursor",
              status: 400,
              detail: "The provided nextCursor is invalid"
            })
          };
        }
      }

      const result = await docClient.send(new ScanCommand(params));
      
      const response = {
        items: result.Items || []
      };

      // Add nextCursor if there are more results
      if (result.LastEvaluatedKey) {
        response.nextCursor = Buffer.from(
          JSON.stringify(result.LastEvaluatedKey)
        ).toString('base64');
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response)
      };
    }

    // POST /students - Create new student
    if (path === "/students" && method === "POST") {
      const body = JSON.parse(event.body || "{}");

      if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            type: "https://httpstatuses.com/400",
            title: "Invalid request body",
            status: 400,
            detail: "Field 'name' is required and must be a non-empty string"
          })
        };
      }

      const id = Date.now();
      const newStudent = {
        pk: `STUDENT#${id}`,
        sk: `STUDENT#${id}`,
        id: id,
        name: body.name.trim(),
        createdAt: new Date().toISOString()
      };

      // Save to DynamoDB
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newStudent
      }));

      // Publish SNS notification
      if (SNS_TOPIC_ARN) {
        try {
          const message = {
            eventType: "StudentEnrolled",
            student: {
              id: newStudent.id,
              name: newStudent.name,
              createdAt: newStudent.createdAt
            },
            timestamp: new Date().toISOString()
          };

          await snsClient.send(new PublishCommand({
            TopicArn: SNS_TOPIC_ARN,
            Message: JSON.stringify(message),
            Subject: "New Student Enrolled",
            MessageAttributes: {
              eventType: {
                DataType: "String",
                StringValue: "StudentEnrolled"
              }
            }
          }));

          console.log("SNS notification sent:", message);
        } catch (snsError) {
          console.error("Failed to send SNS notification:", snsError);
          // Don't fail the request if SNS fails
        }
      }

      return {
        statusCode: 201,
        headers: {
          ...headers,
          "Location": `/students/${newStudent.id}`
        },
        body: JSON.stringify({
          id: newStudent.id,
          name: newStudent.name
        })
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        type: "https://httpstatuses.com/404",
        title: "Not Found",
        status: 404,
        detail: `Route ${method} ${path} not found`
      })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        type: "https://httpstatuses.com/500",
        title: "Internal Server Error",
        status: 500,
        detail: error.message
      })
    };
  }
};
