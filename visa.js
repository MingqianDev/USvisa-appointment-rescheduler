const puppeteer = require('puppeteer-core');
const { parseISO, compareAsc, isBefore, format } = require('date-fns')
const cron = require('cron');
require('dotenv').config();

const { delay, sendEmail, logStep, readUsers, random } = require('./utils');
const { siteInfo, loginCred, IS_PROD, NEXT_SCHEDULE_POLL, NOTIFY_ON_DATE_BEFORE } = require('./config');
const reschedule = require('./reschedule.js')

const userData = readUsers()
let failedNum = 0;
let delayTime = NEXT_SCHEDULE_POLL;
let isLoggedIn = false;
let triesNum = 0;

const login = async (page, user) => {
  logStep('logging in');
  await page.goto(`https://ais.usvisa-info.com/${siteInfo.COUNTRY_CODE}/niv/users/sign_in`);

  const form = await page.$("form#sign_in_form");

  const email = await form.$('input[name="user[email]"]');
  const password = await form.$('input[name="user[password]"]');
  const privacyTerms = await form.$('input[name="policy_confirmed"]');
  const signInButton = await form.$('input[name="commit"]');

  await email.type(user.email);
  await password.type(loginCred.PASSWORD);
  await privacyTerms.click();
  await signInButton.click();

  await page.waitForNavigation();

  return true;
}

const notifyMe = async (earliestData) => {
  const formattedDate = format(earliestData[1], "yyyy-MM-dd");
  logStep(`sending an email to schedule for ${formattedDate}`);
  await sendEmail({
    subject: `We found an earlier date ${formattedDate}(${earliestData[0]})`,
    text: `Hurry and schedule for ${formattedDate} before it is taken.(${earliestData[0]})`
  })
}

const checkForSchedules = async (page, user) => {
  logStep('checking for schedules');
  await page.setExtraHTTPHeaders({
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest'
  });

  const DataUrl = `https://ais.usvisa-info.com/${siteInfo.COUNTRY_CODE}/niv/schedule/${user.scheduleID}/payment`
  try {
    await page.goto(DataUrl);
  } catch (err) {
    console.error(err);
  };


  const rows = await page.$$('table.for-layout tbody tr');

  let earliestDate = null;
  let earliestLocation = null;

  for (const row of rows) {
    const columns = await row.$$('td');
    const location = await columns[0].evaluate(element => element.textContent.trim());
    const dateText = await columns[1].evaluate(element => element.textContent.trim());

    // Check if the date is valid (not equal to "No Appointments Available")
    if (dateText !== 'No Appointments Available') {
      const date = new Date(dateText);
      if (!earliestDate || date < earliestDate) {
        earliestDate = date;
        earliestLocation = location;
      }
    }
  }
  if (earliestDate != null) {
    console.log(`earliest date: ${earliestLocation} ${format(earliestDate, "yyyy-MM-dd")}`);
    failedNum = 0;
  } else {
    failedNum++;
    console.log(`No Appointments Available`);
  }

  if (earliestDate == null) {
    return 0;
  } else {
    return [earliestLocation, earliestDate];
  }
}

const process = async (browser, user) => {
  logStep(`Starting processs with ${++triesNum}th tries`)
  console.log("current user:" + user.email);
  const page = await browser.newPage();

  if (!isLoggedIn) {
    try {
      isLoggedIn = await login(page, user);
    } catch (err) {
      console.error(err);
    }
  }

  const earliestData = await checkForSchedules(page, user);
  const notifyDate = new Date(NOTIFY_ON_DATE_BEFORE);
  if (earliestData[1] && earliestData[1] < notifyDate) {
    await reschedule(earliestData[0], earliestData[1], page);

    await notifyMe(earliestData);
    // await login(page);
  }

  if (failedNum % 15 == 0 && failedNum != 0) {
    await sendEmail({
      subject: 'Visa Appointment Scheduler has failed for 15 times',
      text: 'Please check the logs for more details'
    });
  }

  await delay(1_000);
  await page.close();
}


(async () => {
  let user = userData[random(0, userData.length - 1)]
  // console.log(userData);
  const browser = await puppeteer.launch({
    headless: IS_PROD,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  await process(browser, user);

  try {
    const scheduleCheck = new cron.CronJob('*/1 * * * *', async () => {
      if (triesNum % 10 == 0 && triesNum != 0) {
        user = userData[random(0, userData.length - 1)]
        isLoggedIn = false;
      }
      if (failedNum % 2 == 0 && failedNum != 0) { //change account
        user = userData[random(0, userData.length - 1)]
        isLoggedIn = false;
      }
      await process(browser, user);
    })
    scheduleCheck.start();
  } catch (err) {
    console.error(err);
  }

  // await browser.close();
})();


