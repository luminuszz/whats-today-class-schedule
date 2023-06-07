import "dotenv/config";

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

import { formatJSONResponse } from "@libs/api-gateway";
import { EventBridgeHandler } from "aws-lambda";
import * as cheerio from "cheerio";
import { Redis } from "ioredis";

const createProvider = async () => {
  const redisInstance = new Redis({
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD,
    port: Number(process.env.REDIS_PORT),
    lazyConnect: false,
  });

  const needToCreateANewConnection =
    redisInstance.status !== "ready" && redisInstance.status !== "connecting";

  if (needToCreateANewConnection) {
    await redisInstance.connect();
  }

  return redisInstance;
};

function delay(time: number) {
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
      "http://novoportal.ucsal.br/FrameHTML/web/app/edu/PortalEducacional/#/calendario",
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

    const topic = await createProvider();

    const period = new Date();

    await topic.set(
      `topics:notification-class:${period.getTime()}`,
      JSON.stringify({
        firstClass: classes[0],
        secondClass: classes[1],
        period: period.toLocaleString("pt-BR"),
        matricula: process.env.PORTAL_USER_LOGIN,
        sent: false,
      })
    );

    topic.disconnect();

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

