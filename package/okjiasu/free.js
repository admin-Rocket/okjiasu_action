/**
 * 免费的clash节点爬取
 * @author        h7ml <h7ml@qq.com>
 * @date          2022-11-09 18:11:55
 * @lastModified  2022-11-09 18:12:40
 * Copyright © www.h7ml.cn All rights reserved
 */
const puppeteer = require("puppeteer");
const dayjs = require("dayjs");
const config = require("../../config/index");
const path = require("path");
const fs = require("fs");
const open_url_by_browser = require("open-url-by-browser");
const { sendEmail } = require(`../../utils/email`);
const { getHitokotoWords } = require("../../utils/hitokoto");
const { getElementAttribute } = require("../../utils/puppeteer");
const QRCode = require('qrcode')
/**
 * 截屏pdf所存目录
 */
const freePath = path.join(__dirname, "./free");
const readmePath = path.join(__dirname, `./README.md`);
/**
 * 判断是否存在 freePath 目录
 */
if (!fs.existsSync(freePath)) {
  console.log(`不存在目录 ${freePath}, 创建目录`);
  fs.mkdirSync(freePath);
}

/**
 * 输出当前时间
 * @returns {string} 当前时间
 */
const nowTime = (format = "YYYY-MM-DD-HH-mm-ss") => {
  return dayjs().format(format);
};


/**
 * @description: puppeteer浏览器的配置项
 */
const browserOptions = {
  headless: false,
  ignoreDefaultArgs: ["--disable-extensions"],
  defaultViewport: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: false,
  },
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--use-gl=egl",
    "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process",
  ],
};


/**
 * @description: 获取订阅链接
 */
const getFreescribeUrl = async (page) => {
  let subscribeUrl = [];
  const n = await page.$$(".media", (element) => element);
  console.log(`${nowTime()} : 获取到 ${n.length} 个免费节点`);
  // 有效节点
  const validNode = await page.$$(".node-is-online", (element) => element);
  // 点击每个节点
  await Promise.all(
    validNode.map(async (item, index) => {
      await page.waitForTimeout(1000);
      await item.executionContext().evaluate((item) => item.click({ delay: 50 }), item)
      const textInfo = await item
        .executionContext()
        .evaluate((item) => item.textContent, item);
      console.log(`${nowTime('YYYY-MM-DDTHH:mm:ssZ[Z]')} : 点击节点 ${textInfo}`);
      // 打开iframe id 为 infoifram 的src地址
      await page.waitForTimeout(1000);
      await page.waitForSelector("#infoifram");
      const iframeUrl = await getElementAttribute(page, "#infoifram", "src");
      const [
        order, text, url, detail
        //  online, ratio, load, rate
      ] = [
          index + 1,// 序号,
          textInfo.replaceAll(" ", "").replaceAll('|', ''), // 节点名称
          'https://okjiasu.com/user/' + iframeUrl.replaceAll('./', ''),
          {
            "ip": "112.18.159.71",
            "port": "43285",
            "alterID": "0",
            "UUid": "ffe24759-fd41-334c-92a4-89fcc47ef493",
            "protocol": "tcp",
            "vmess": "vmess://eyJob3N0IjoiIiwicGF0aCI6IiIsInRscyI6IiIsInZlcmlmeV9jZXJ0Ijp0cnVlLCJhZGQiOiIxMTIuMTguMTU5LjcxIiwicG9ydCI6NDMyODUsImFpZCI6MCwibmV0IjoidGNwIiwiaGVhZGVyVHlwZSI6Im5vbmUiLCJzZXJ2aWNlbmFtZSI6IiIsImVuYWJsZV94dGxzIjoiIiwiZmxvdyI6Inh0bHMtcnByeC1kaXJlY3QiLCJ2dHlwZSI6InZtZXNzOi8vIiwic25pIjoiIiwidiI6IjIiLCJ0eXBlIjoidm1lc3MiLCJwcyI6Iummmea4rzPvvIjlgI3njocz77yJIiwicmVtYXJrIjoi6aaZ5rivM++8iOWAjeeOhzPvvIkiLCJpZCI6ImZmZTI0NzU5LWZkNDEtMzM0Yy05MmE0LTg5ZmNjNDdlZjQ5MyIsImNsYXNzIjoyfQ==",
            "qrcode": "/free/2022-11-10-20-12-30.png"
          },
          '',// 在线人数
          '', // 速度比例
          '',// 负载
          '', // 速率
        ];
      console.log(`${nowTime('YYYY-MM-DDTHH:mm:ssZ[Z]')} : 获取到第${order}的节点${text}订阅链接 ${url}`);
      subscribeUrl.push({
        order, text, url, detail
      });
      await page.click("span[aria-hidden='true']");
      await page.waitForTimeout(1000);
    })

  );
  console.log(`${nowTime()} : 节点信息采集完毕`);
  return subscribeUrl;
};

/**
 * 生成二维码并保存
 * @param {*} text 
 * @returns 存储的地址
 */
const generateQR = async text => {
  const qrcodePath = path.join(freePath, `./${nowTime()}.png`)
  try {
    await QRCode.toFile(qrcodePath, text)
  } catch (err) {
    console.error(err)
  }
  return qrcodePath.split('okjiasu')[2].replaceAll("\\", "/")
}


/**
 * @description: 获取所有免费订阅信息
 */
const openIframeUrl = async (page, data) => {
  const matchPath = /([\u4e00-\u9fa5]|AlterID).*?：(.*?)[[\u4e00-\u9fa5]*|AlterID|$]/g;
  await Promise.all(
    data.map(async (item, index) => {
      await page.waitForTimeout(index * 1200);
      try {
        console.log(`获取第${item.order}个节点${item.text} ${item.url}`);
        await page.goto(`${item.url}`);
        const tabContent = await page.$(".tab-content");
        const tabContentText = await tabContent.evaluate((item) =>
          item.textContent, tabContent);
        const detailInfo = tabContentText
          .replaceAll(" ", "") // 去除空格 必须放在最前面
          .replaceAll("\n", "") // 去除换行
          .replaceAll('点击添加点击复制', '') // 去除多余的字符
          .replace(matchPath, '|') // 替换为 |
          .split('|') // 分割为数组
        const btnPrimary = await page.$$(".btn-primary");
        const btnPrimaryHref = await getElementAttribute(page, ".btn-primary", "href");
        const vmessQrcode = await generateQR(btnPrimaryHref);
        const [temp, ip, port, alterID, UUid, protocol, vmess, qrcode] = [...detailInfo, btnPrimaryHref, vmessQrcode];
        item['detail'] = { ip, port, alterID, UUid, protocol, vmess, qrcode };
      } catch (e) {
        console.log(e, 'error');
      }
      await page.waitForTimeout(index * 1000)
    })
  );
  console.log(`${nowTime()} : 获取所有免费订阅信息完毕`);
  return data;
};

/**
 * 获取免费节点
 * @param {*} page 
 */
const getFreeList = async (page) => {
  const freejsonpath = path.join(freePath, `free-${nowTime('YYYY-MM-DD')}.json`);
  console.log(`${nowTime()} : 跳转到节点列表页`);
  await page.goto('https://okjiasu.com/user/node')
  console.log(`${nowTime()} : 获取订阅链接`);
  const subscribeUrl = await getFreescribeUrl(page);
  console.log(`${nowTime()} : 订阅链接获取完毕`);
  console.log(`${nowTime()} : 保存订阅链接到 ${freejsonpath}`);
  fs.writeFileSync(freejsonpath,
    JSON.stringify(subscribeUrl, null, 4),
    { encoding: "utf8", flag: "w" });
  console.log(`${nowTime()} : 保存订阅链接到 ${freejsonpath}完毕`);
  console.log(`${nowTime()} : 开始获取订阅链接详情`);
  const FreeList = await openIframeUrl(page, subscribeUrl);
  console.log(`${nowTime()} : 订阅链接详情获取完毕`);
  return FreeList;
};


// 写入到readme
const writeReadme = async (data) => {
  const readme = fs.readFileSync(readmePath, { encoding: "utf8", flag: "r" });
  // 内容模板
  const tableContent =
    data.map((item) => {
      // | 节点名称 | 节点ip | 节点端口 | 节点ID | 节点协议 |节点链接 | 节点二维码 |`
      const { text, detail } = item;
      const { ip, port, alterID, UUid, protocol, vmess, qrcode } = detail;
      return `| ${text} | ${ip} | ${port} | ${alterID} | ${protocol} | [点击导入](${vmess}) | ![二维码](${qrcode}) |`;
      // 解决生成的有,号的问题
    })
  // 将 tableContent 里得我逗号替换为换行
  const tableContentStr = tableContent.join('\n').replaceAll(',', '\n')
  await fs.writeFileSync(readmePath,
    `${readme}${tableContentStr}`,
    { encoding: "utf8", flag: "w" });
  console.log(`${nowTime()} : 写入到${readmePath} 完毕`);
}

/**
 * 签到主方法
 * @param {*} options
 * @returns
 */
const getBrowser = async (options) => {
  const freeListPath = path.join(freePath, `freeList-${nowTime('YYYY-MM-DD')}.json`);
  if (!global._browser) {
  }
  try {
    puppeteer.launch(browserOptions).then(async (browser) => {
      const page = await browser.newPage();
      await page.goto(config.okjiasu.login);
      await page.waitForTimeout(1000);
      await page.type("#email", config.okjiasu.user, { delay: 50 });
      console.log(`${nowTime()} : 输入账号 ${config.okjiasu.user} `);
      await page.waitForTimeout(1000);
      console.log(`${nowTime()} : 输入密码 ******** `);
      await page.type("#password", config.okjiasu.password, { delay: 50 });
      // await page.waitForTimeout(2000)
      console.log(`${nowTime()} : 开始登陆`);
      await page.click("button[type=submit]");
      await page.waitForTimeout(2000);
      const FreeList = await getFreeList(page);
      console.log(`${nowTime()} : 关闭浏览器`);
      await browser.close();
      await closeBrowser();
      console.log(`${nowTime()} : 保存免费节点到 ${freeListPath} `);
      await fs.writeFileSync(freeListPath,
        JSON.stringify(FreeList, null, 4),
        { encoding: "utf8", flag: "w" });
      // 当前写入时间
      const nowTimeStr = `## 采集时间: ${nowTime('YYYY-MM-DD HH:mm:ss')} `;
      // 头部表格模板
      const tableHeader = `| 节点名称 | 节点ip | 节点端口 | 节点ID | 节点协议 | 节点链接 | 节点二维码 |`;
      // 换行符
      const lineBreak = `| :---: | :---: | :---: | :---: | :---: |  :---: | :---: |`;
      // 判断readmePath文件 是否存在，不存在则创建
      if (!fs.existsSync(readmePath)) {
        console.log("readme.md文件不存在，创建readme.md文件,并写入头部表格模板");
        // 写入头部模板和换行符,并换行
        await fs.writeFileSync(readmePath, `${nowTimeStr}\n${tableHeader}\n${lineBreak}\n`, { encoding: "utf8", flag: "w" });
      }
      await writeReadme(FreeList);
      process.exit(0);
    });
  } catch (error) {
    console.log(error.message || "puppeteer启动失败");
  }
  return global._browser || null;
};

const closeBrowser = async () => {
  if (global._browser) {
    await global._browser.close();
    global._browser = null;
  }
};
getBrowser();
module.exports = {
  getBrowser,
  closeBrowser,
};
