const puppeteer = require('puppeteer-core');
require('dotenv').config();
const { delay } = require('./utils');
const cheerio = require('cheerio');
const axios = require('axios');
const { loginCred } = require('./config');

const IS_PROD = false;

const NEW_APPLICANT = 'https://ais.usvisa-info.com/en-ca/niv/signup?user_id='
const FIRSTNAME = 'SDJK';
const LASTNAME = 'HBNV';
const PASSPORT_NUM = 'G37062334';
const DS_160_NUM = 'AA00CKB' + Math.random().toString(36).substring(2, 5).toUpperCase();
const PHONE = '202-519-9759';
const CAREOF = 'La Coulon J';
const ADDRESS = '123 Main St';
const ZIP = '20763';
const CITY = 'Savage';

// let REGISTER_URL = '';
let account = [];

async function getEmail() {
  const getEmailOptions = {
    method: 'POST',
    url: 'https://gmailnator.p.rapidapi.com/generate-email',
    headers: {
      'content-type': 'application/json',
      'X-RapidAPI-Key': `${process.env.GMAILNATOR_API_KEY}`,
      'X-RapidAPI-Host': 'gmailnator.p.rapidapi.com'
    },
    data: { options: [3] }
  };
  try {
    const response = await axios.request(getEmailOptions);
    return response.data.email;
  } catch (error) {
    console.error(error);
  }
}

async function getInbox(email) {
  const inboxOptions = {
    method: 'POST',
    url: 'https://gmailnator.p.rapidapi.com/inbox',
    headers: {
      'content-type': 'application/json',
      'X-RapidAPI-Key': `${process.env.GMAILNATOR_API_KEY}`,
      'X-RapidAPI-Host': 'gmailnator.p.rapidapi.com'
    },
    data: {
      email: `${email}`,
      limit: 10
    }
  };

  try {
    const response = await axios.request(inboxOptions);
    for (const message of response.data) {
      if (message.from.includes('donotreply@usvisa-info.com')) {
        return message.id;
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function getMessage(id) {
  const messageOptions = {
    method: 'GET',
    url: 'https://gmailnator.p.rapidapi.com/messageid',
    params: {
      id: `${id}`
    },
    headers: {
      'X-RapidAPI-Key': `${process.env.GMAILNATOR_API_KEY}`,
      'X-RapidAPI-Host': 'gmailnator.p.rapidapi.com'
    }
  };
  try {
    const response = await axios.request(messageOptions);
    return response.data.content;
  } catch (error) {
    console.error(error);
  }
}

async function getRegisterUrl(email) {
  const id = await getInbox(email);
  const message = await getMessage(id);
  const $ = cheerio.load(message);
  const link = $('a').attr('href');
  return link;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await browser.newPage();
  const email = await getEmail();
  await page.goto(NEW_APPLICANT);
  await page.type('#user_first_name', FIRSTNAME);
  await page.type('#user_last_name', LASTNAME);
  await page.type('#user_email', email);
  await page.type('#user_email_confirmation', email);
  await page.type('#user_password', `${loginCred.PASSWORD}`);
  await page.type('#user_password_confirmation', `${loginCred.PASSWORD}`);
  await page.click('#policy_confirmed');
  await page.click("input[type='submit'][name='commit']");

  const REGISTER_URL = await getRegisterUrl(email);
  await page.goto(REGISTER_URL);
  try {
    await delay(5_000)
    await page.click('.button');
    await delay(2000);
    await page.select('#applicant_passport_country_code', 'CN');
    await page.select('#applicant_birth_country_code', 'CN');
    await page.select('#applicant_permanent_residency_country_code', 'cn');
    await page.type('#applicant_passport_number', PASSPORT_NUM);
    await page.type('#applicant_ds160_number', DS_160_NUM);
    await page.select('#applicant_visa_class_id', '3');
    await page.select('#applicant_date_of_birth_3i', '10');
    await page.select('#applicant_date_of_birth_2i', '10');
    await page.select('#applicant_date_of_birth_1i', '1990');
    await page.select('#applicant_gender', 'M');
    await page.type('#applicant_phone1', PHONE);
    await page.click('#applicant_is_a_renewal_false');
    await page.click('#applicant_traveling_to_apply_true');
    await page.click('input[type="submit"][value="Create Applicant"]');
    await delay(2_000);
    await page.click('input[type="submit"][value="Yes"]');
    await delay(2000);
    await page.click('#none_apply');
    await page.click('input[type="submit"][value="Confirm"]');
    await delay(2000);
    await page.click('.button:nth-of-type(2)');
    await delay(2000);
    await page.select('#tiered_form_state', 'ON');
    await delay(2000);
    await page.select('#tiered_form_id', '6995677');
    await page.select('#tiered_form_country', 'United States');
    await page.type('#group_care_of', CAREOF);
    await page.type('#group_residence_address_street1', ADDRESS);
    await page.type('#home-delivery-postal-code', ZIP);
    await page.type('#group_residence_address_city', CITY);
    await delay(1000);
    await page.click('input[type="submit"][value="Continue"]');

    console.log("email" + email)
    const scheduleID_URL = await page.url();
    const scheduleID = scheduleID_URL.match(/\d+/)[0];
    account.push({
      email: email,
      scheduleID: scheduleID
    });
    await delay(3000);
  } catch (err) {
    console.error(err);
  }
  console.log(account);
  await browser.close();
})();
