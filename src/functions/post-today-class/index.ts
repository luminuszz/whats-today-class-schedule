import { handlerPath } from "@libs/handler-resolver";

export default {
  timeout: 100,
  handler: `${handlerPath(__dirname)}/handler.main`,
  layers: ["arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda:31"],
  events: [
    {
      schedule: "cron(0 16 ? * MON-FRI *)",
    },
  ],
};
