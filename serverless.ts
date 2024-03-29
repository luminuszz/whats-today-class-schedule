import "dotenv/config";

import type { AWS } from "@serverless/typescript";

import hello from "@functions/hello";
import postTodayClass from "@functions/post-today-class";

const serverlessConfiguration: AWS = {
  service: "whats-today-class-schedule",
  useDotenv: true,
  frameworkVersion: "3",
  plugins: [
    "serverless-esbuild",
    "serverless-offline",
    "serverless-plugin-lambda-dead-letter",
  ],
  provider: {
    name: "aws",
    runtime: "nodejs16.x",
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },

    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      NODE_OPTIONS: "--enable-source-maps --stack-trace-limit=1000",
    },
  },
  // import the function via paths
  functions: { hello, postTodayClass },
  package: { individually: true },

  custom: {
    esbuild: {
      external: ["@sparticuz/chromium"],
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ["aws-sdk"],
      target: "node14",
      define: { "require.resolve": undefined },
      platform: "node",
      concurrency: 10,
    },
  },
};

module.exports = serverlessConfiguration;
