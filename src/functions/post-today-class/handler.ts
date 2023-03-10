import "dotenv/config";

import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/api-gateway";
import { formatJSONResponse } from "@libs/api-gateway";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

import { Kafka } from "kafkajs";
import * as process from "process";

const createKafkaConnection = () =>
  new Kafka({
    clientId: "whats-today-class-schedule-aws-lambda",
    brokers: [process.env.KAFKA_CONEECT_URL],
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

export const postTodayClass: ValidatedEventAPIGatewayProxyEvent<
  any
> = async () => {
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

    await delay(2000);

    await page.click('*[data-name="agenda"]');

    const todayClassRomm = await page.evaluate(() => {
      const items: string[] = [];

      document.querySelectorAll(".k-today").forEach((item: any) => {
        items.push(item.innerText);
      });

      return items;
    });

    const period = await page.$eval(
      '*[data-bind="text: formattedShortDate"]',
      (element: any) => element.innerText
    );

    console.log("Screenshot calendar");

    console.log({ todayClassRomm, period });

    await browser.close();

    const topic = createKafkaConnection();

    await topic.connect();

    await topic.send({
      topic: "notification.classroom-today",
      messages: [
        {
          value: JSON.stringify({
            classoroms: todayClassRomm.map((item) =>
              item.replaceAll("\n", " ").replaceAll("\t", "")
            ),
            period,
            matricula: process.env.PORTAL_USER_LOGIN,
          }),
        },
      ],
    });

    await topic.disconnect();

    return formatJSONResponse({
      classoroms: todayClassRomm.map((item) =>
        item.replaceAll("\n", " ").replaceAll("\t", "")
      ),
      status: 200,
      period,
    });
  } catch (e) {
    console.error(e);

    return formatJSONResponse({ message: e.message, status: 400 });
  }
};

export const main = postTodayClass;
