const Mailgun = require('mailgun.js');
const formData = require('form-data');
const fs = require('fs');

const mailgun = new Mailgun(formData);
const config = require('./config');
const mg = mailgun.client({ username: 'api', key: config.mailgun.API_KEY });

const debug = async (page, logName, saveScreenShot) => {
  if (saveScreenShot) {
    await page.screenshot({ path: `${logName}.png` });
  }

  await page.evaluate(() => {
    debugger;
  });
};

const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));

const sendEmail = async (params) => {
  console.log(params);
  const data = {
    from: 'No reply <noreply@visa-schedule-check>',
    to: config.NOTIFY_EMAILS,
    subject: 'Hello US VISA schedules',
    ...params
  };
  await mg.messages.create(config.mailgun.DOMAIN, data)
};

const logStep = (stepTitle) => {
  const newDate = new Date();
  const currentTime = newDate.toLocaleTimeString();
  console.log(`[${currentTime}] =====>>> Step:`, stepTitle);
};

const readUsers = () => {
    const data = fs.readFileSync('users.json');
    return JSON.parse(data);
};
const random = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports = {
  debug,
  delay,
  sendEmail,
  logStep,
  readUsers,
  random
}
