export const handler = async (event) => {
  console.log("Received SQS event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      // Parse SNS message from SQS
      const snsMessage = JSON.parse(record.body);
      console.log("SNS Message:", JSON.stringify(snsMessage, null, 2));

      // Parse the actual student enrollment data
      const studentData = JSON.parse(snsMessage.Message);
      console.log("Student Enrollment Data:", JSON.stringify(studentData, null, 2));

      // Simulate email sending (in real scenario, use SES)
      const emailContent = {
        to: "admin@example.edu",
        subject: snsMessage.Subject || "New Student Enrolled",
        body: `
Student Enrollment Notification
================================

A new student has been enrolled:

- Student ID: ${studentData.student.id}
- Name: ${studentData.student.name}
- Enrolled At: ${studentData.student.createdAt}
- Event Type: ${studentData.eventType}
- Event Timestamp: ${studentData.timestamp}

This is an automated notification.
        `.trim()
      };

      console.log("📧 Email sent (simulated):", JSON.stringify(emailContent, null, 2));
      console.log(`✅ Successfully processed student enrollment: ${studentData.student.name}`);

    } catch (error) {
      console.error("❌ Error processing record:", error);
      console.error("Record body:", record.body);
      // In production, consider DLQ for failed messages
      throw error; // This will mark the message as failed and retry
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Successfully processed ${event.Records.length} messages`
    })
  };
};
