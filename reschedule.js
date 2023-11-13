// const puppeteer = require('puppeteer');
const { parseISO, compareAsc, isBefore, format } = require('date-fns')
require('dotenv').config();
const querystring = require('querystring');
const { delay, logStep } = require('./utils');
const { siteInfo, loginCred, IS_PROD, NEXT_SCHEDULE_POLL, NOTIFY_ON_DATE_BEFORE } = require('./config');
const axios = require('axios');

// Add or modify entries as needed. 
// The key is the city name, and the value is the FACILITY_ID.
cityMap = new Map();
cityMap.set('Calgary', 89);
cityMap.set('Ottawa', 92);
cityMap.set('Toronto', 94);
cityMap.set('Vancouver', 95);

// const IS_PROD = false;
const APPOINTMENT_URL = `https://ais.usvisa-info.com/${siteInfo.COUNTRY_CODE}/niv/schedule/${siteInfo.SCHEDULE_ID}/appointment`

const login = async (page) => {
    logStep('logging in');
    await page.goto(`https://ais.usvisa-info.com/${siteInfo.COUNTRY_CODE}/niv/users/sign_in`);

    const form = await page.$("form#sign_in_form");

    const email = await form.$('input[name="user[email]"]');
    const password = await form.$('input[name="user[password]"]');
    const privacyTerms = await form.$('input[name="policy_confirmed"]');
    const signInButton = await form.$('input[name="commit"]');

    await email.type(`${loginCred.EMAIL}`);
    await password.type(`${loginCred.PASSWORD}`);
    await privacyTerms.click();
    await signInButton.click();

    await page.waitForNavigation();
}

const reschedule = async (city, date, page) => {
    // const browser = await puppeteer.launch(!IS_PROD ? { headless: false } : undefined);
    // page = await browser.newPage();
    await login(page);

    await page.setExtraHTTPHeaders({
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
    });

    await page.goto(`https://ais.usvisa-info.com/${siteInfo.COUNTRY_CODE}/niv/schedule/${siteInfo.SCHEDULE_ID}/appointment/times/${cityMap.get(city)}.json?date=${format(date, "yyyy-MM-dd")}&appointments[expedite]=false`);
    const bodyText = await page.evaluate(() => {
        return document.querySelector('body').innerText
    });
    const parsedBody = JSON.parse(bodyText);
    const timeOfAppt = parsedBody.available_times[0];

    await page.goto(APPOINTMENT_URL);

    logStep('rescheduling')

    const FACILITY_ID = cityMap.get(city)
    // console.log(FACILITY_ID.toString());
    await page.select('#appointments_consulate_appointment_facility_id', FACILITY_ID.toString());
    await delay(700);
    // console.log(format(date, "yyyy-MM-dd"));
    await page.evaluate(() => {
        const input = document.querySelector('#appointments_consulate_appointment_date');
        input.removeAttribute('readonly');
    });
    await page.type('#appointments_consulate_appointment_date', format(date, "yyyy-MM-dd"))
    await page.keyboard.press('Enter');
    await page.click('#consulate-appointment-fields');
    console.log(timeOfAppt);
    await delay(500);
    await page.select('#appointments_consulate_appointment_time', timeOfAppt);
    await page.click('#appointments_submit');

    // const data = {
    //     "authenticity_token": await page.$eval('input[name=authenticity_token]', input => input.value),
    //     "confirmed_limit_message": await page.$eval('input[name=confirmed_limit_message]', input => input.value),
    //     "use_consulate_appointment_capacity": await page.$eval('input[name=use_consulate_appointment_capacity]', input => input.value),
    //     "appointments[consulate_appointment][facility_id]": cityMap.get(city),
    //     "appointments[consulate_appointment][date]": '2026-02-11',
    //     "appointments[consulate_appointment][time]": timeOfAppt,
    //     // "commit": "Schedule Appointment"
    // };

    // const headers = {
    //     "User-Agent": await page.evaluate(() => navigator.userAgent),
    //     "Referer": APPOINTMENT_URL,
    //     "Cookie": "_yatri_session=" + (await page.cookies()).find(cookie => cookie.name === '_yatri_session').value
    // };

    // const postData = querystring.stringify(data);
    // const postHeaders = querystring.stringify(headers);

    // console.log(postData);
    // console.log(headers);

    // try {
    //     const response = await axios.post(APPOINTMENT_URL, postData, { headers });
    //     if (response.data.includes('Successfully Scheduled')) {
    //         // const msg = `Rescheduled Successfully! ${date} ${time}`;
    //         // send_notification(msg);
    //         // EXIT = true;
    //         console.log("Rescheduled Successfully!");
    //         console.log(response);
    //     } else {
    //         console.log("Rescheduled Failed.");
    //         console.log(response);
    //         // const msg = `Reschedule Failed. ${date} ${time}`;
    //         // send_notification(msg);
    //     }
    // } catch (error) {
    //     console.error('Error occurred during the POST request:', error);
    // }

    // await browser.close();
};

// reschedule("Vancouver", new Date("Tue Mar 2 2026 00:00:00 GMT-0500"))
module.exports = reschedule;
