// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import type { NextApiRequest, NextApiResponse } from "next";
const puppeteer = require("puppeteer-core");
const util = require('util');
const request = require('request')
// const chromium = require("chrome-aws-lambda");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const ChromeLauncher = require("chrome-launcher");

export class MetaData {
  getTitle = async (page: any) => {
    const title = await page.evaluate(() => {
      const ogTitle: any = document.querySelector('meta[property="og:title"]');
      if (ogTitle != null && ogTitle.content.length > 0) {
        return ogTitle.content;
      }
      const twitterTitle: any = document.querySelector(
        'meta[name="twitter:title"]'
      );
      if (twitterTitle != null && twitterTitle.content.length > 0) {
        return twitterTitle.content;
      }
      const docTitle: any = document.title;
      if (docTitle != null && docTitle.length > 0) {
        return docTitle;
      }
      const h1: any = document.querySelector("h1")?.innerHTML ?? null;
      if (h1 != null && h1.length > 0) {
        return h1;
      }
      const h2 = document.querySelector("h1")?.innerHTML;
      if (h2 != null && h2.length > 0) {
        return h2;
      }
      return null;
    });
    return title;
  };

  getDescription = async (page: any) => {
    const description = await page.evaluate(() => {
      const ogDescription: any = document.querySelector(
        'meta[property="og:description"]'
      );
      if (ogDescription != null && ogDescription.content.length > 0) {
        return ogDescription.content;
      }
      const twitterDescription: any = document.querySelector(
        'meta[name="twitter:description"]'
      );
      if (twitterDescription != null && twitterDescription.content.length > 0) {
        return twitterDescription.content;
      }
      const metaDescription: any = document.querySelector(
        'meta[name="description"]'
      );
      if (metaDescription != null && metaDescription.content.length > 0) {
        return metaDescription.content;
      }

      const paragraphs: any = document.querySelectorAll("p");
      let fstVisibleParagraph = null;
      for (let i = 0; i < paragraphs.length; i++) {
        if (
          // if object is visible in dom
          paragraphs[i].offsetParent !== null
          // !paragraphs[i].childElementCount != 0
        ) {
          fstVisibleParagraph = paragraphs[i].textContent;
          break;
        }
      }
      return fstVisibleParagraph;
    });
    return description;
  };

  getDomainName = async (page: any, uri: string) => {
    const domainName = await page.evaluate(() => {
      const canonicalLink: any = document.querySelector("link[rel=canonical]");
      if (canonicalLink != null && canonicalLink.href.length > 0) {
        return canonicalLink.href;
      }
      const ogUrlMeta: any = document.querySelector('meta[property="og:url"]');
      if (ogUrlMeta != null && ogUrlMeta.content.length > 0) {
        return ogUrlMeta.content;
      }
      return null;
    });
    return domainName != null
      ? new URL(domainName).hostname.replace("www.", "")
      : new URL(uri).hostname.replace("www.", "");
  };

  getImg = async (page: any, uri: string) => {
    const img = await page.evaluate(async () => {
      const ogImg: any = document.querySelector('meta[property="og:image"]');
      if (ogImg != null && ogImg.content.length > 0) {
        return ogImg.content;
      }
      const imgRelLink: any = document.querySelector('link[rel="image_src"]');
      if (imgRelLink != null && imgRelLink.href.length > 0) {
        return imgRelLink.href;
      }
      const twitterImg: any = document.querySelector(
        'meta[name="twitter:image"]'
      );
      if (twitterImg != null && twitterImg.content.length > 0) {
        return twitterImg.content;
      }

      return null;
    });
    return img;
  };

  getData = async (
    uri: string,
    puppeteerArgs = [],
    puppeteerAgent = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
  ) => {
    try {
      // puppeteer.use(pluginStealth());
      
      // const browser = await puppeteer.launch({
      //   headless: false,
      //   ignoreDefaultArgs: ["--disable-extensions"],
      //   args: ['--no-sandbox', '--disable-setuid-sandbox'],  //chromium.args,
      //   // defaultViewport: chromium.defaultViewport,
      //   // executablePath: await chromium.executablePath,
      //   ignoreHTTPSErrors: true,
      //   // args: [...puppeteerArgs],
      // });

      console.log("----- FINDING LOCAL CHROME PATH ------")
      const localChromePath= await ChromeLauncher.Launcher.getInstallations()
      console.log("Chrome Path:", localChromePath[0]);

      console.log("----- SETTING LUNCHER OPTIONS ------");
      const opts: any = {
        chromeFlags: ["--headless", " --disable-gpu"],
        chromePath: localChromePath[0],
        logLevel: "info",
        output: "json",
      };

      console.log("----- LAUNCHING CHROME ------");
      const chrome = await ChromeLauncher.launch(opts);
      opts.port = chrome.port;
      const resp = await util.promisify(request)(
        `http://localhost:${opts.port}/json/version`
      );
      const { webSocketDebuggerUrl } = JSON.parse(resp.body);

      console.log("----- LAUNCHING PUPPETEER ------");
      const browser = await puppeteer.connect({
        browserWSEndpoint: webSocketDebuggerUrl,
      });
      console.log("Browser",browser)
      const page = await browser.newPage();
      page.setUserAgent(puppeteerAgent);
      
      await page.setDefaultNavigationTimeout(0); 

      await page.goto(uri);
      // await page.exposeFunction("request", request);
      // await page.exposeFunction("urlImageIsAccessible", urlImageIsAccessible);

      const obj: any = {};
      obj.title = await this.getTitle(page);

      obj.description = await this.getDescription(page);

      obj.domain = await this.getDomainName(page, uri);

      obj.img = await this.getImg(page, uri);

      await browser.close();
      return obj;
    } catch (error) {
      return error;
    }
  };
}
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const metaInstance = new MetaData();
      const response = await metaInstance.getData(req.body.url);
      console.log(response);
      res.status(200).json({ metaData: response });
    } catch (error) {
      res.status(500).json({ error: error });
    }
  }
}
