import "dotenv/config";

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

import { formatJSONResponse } from "@libs/api-gateway";
import { EventBridgeHandler } from "aws-lambda";
import * as cheerio from "cheerio";
import { Kafka } from "kafkajs";

const createKafkaConnection = () =>
  new Kafka({
    clientId: "whats-today-class-schedule-aws-lambda",
    brokers: [process.env.KAFKA_CONNECT_URL],
    ssl: true,
    sasl: {
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD,
      mechanism: "plain",
    },
    retry: {
      retries: 5,
      multiplier: 2,
      maxRetryTime: 10000,
    },
  }).producer();

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

const getBrowser = async () => {
  const args = [
    ...chromium.args,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certifcate-errors",
    "--ignore-certifcate-errors-spki-list",
    '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"',
  ];

  return await puppeteer.launch({
    args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
    ignoreHTTPSErrors: true,
  });
};

export const postTodayClass: EventBridgeHandler<any, any, any> = async () => {
  try {
    const browser = await getBrowser();

    const page = await browser.newPage();

    await page.goto(process.env.PORT_USER_URL, { waitUntil: "networkidle2" });

    await delay(3000);

    console.log("Go to portal page");

    await page.type("#User", String(process.env.PORTAL_USER_LOGIN), {
      delay: 150,
    });
    console.log("making login... user");

    await page.type("#Pass", process.env.PORTAL_PASSWORD_LOGIN, {
      delay: 150,
    });

    console.log("making login... password");

    await page.click(
      "body > div.container > div.login-box.animated.fadeInDown > form > div:nth-child(4) > input[type=submit]"
    );

    await page.waitForNavigation({ waitUntil: "networkidle2" });

    console.log("clicking login button...");

    await delay(2000);

    await page.waitForFunction(
      () => !document.querySelector("#loading-screen")
    );

    await page.click("#btnConfirmar");

    await delay(2000);

    await page.goto(
      "https://cyborg.ucsal.br/FrameHTML/web/app/edu/PortalEducacional/#/calendario",
      { waitUntil: "networkidle2" }
    );

    await delay(1000);

    await page.waitForFunction(
      () => !document.querySelector("#loading-screen")
    );

    await page.waitForSelector('*[data-name="agenda"]');

    await delay(1000);

    await page.click('*[data-name="agenda"]');

    const html = await page.evaluate(() => document.body.innerHTML);

    const $ = cheerio.load(html);

    const classes = $(".k-task.ng-scope")
      .map((_, element) => element.attribs["title"])
      .get();

    await browser.close();

    const topic = createKafkaConnection();

    await topic.connect();

    await topic.send({
      topic: "notification.classroom-today",
      messages: [
        {
          value: JSON.stringify({
            firstClass: classes[0],
            secondClass: classes[1],
            period: new Date().toLocaleDateString("pt-BR"),
            matricula: process.env.PORTAL_USER_LOGIN,
          }),
        },
      ],
    });

    await topic.disconnect();

    return formatJSONResponse({
      firstClass: classes[0],
      secondClass: classes[1],
    });
  } catch (e) {
    console.error(e);

    throw e;
  }
};

export const main = postTodayClass;

