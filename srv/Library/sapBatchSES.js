const axios = require('axios');
const tough = require('tough-cookie');
const { getConnection } = require("./DBConn");
const xml2js = require('xml2js');

let client;
let cookieJar;

async function initClient() {
  if (client && cookieJar) return { client, cookieJar };

  const { wrapper } = await import('axios-cookiejar-support');
  cookieJar = new tough.CookieJar();
  client = wrapper(axios.create({
    jar: cookieJar,
    withCredentials: true
  }));

  return { client, cookieJar };
}

function formatSAPDate(period) {
  try {
    const [from, to] = period.split(" to ");
    const fromTS = new Date(from.trim().split("/").reverse().join("-")).getTime();
    const toTS = new Date(to.trim().split("/").reverse().join("-")).getTime();
    return { from_date: `/Date(${fromTS})/`, end_date: `/Date(${toTS})/` };
  } catch {
    return { from_date: "", end_date: "" };
  }
}

async function buildSESPayloadForSAP(requestNo) {
  const { database } = await getConnection();

  const sesHead = await database.collection("SES_HEAD").findOne({ REQUEST_NO: requestNo });
  if (!sesHead) throw new Error(`SES_HEAD not found for REQUEST_NO ${requestNo}`);

  const Ebeln = sesHead.PO_NUMBER;
  if (!Ebeln) throw new Error(`PO_NUMBER missing in SES_HEAD for REQUEST_NO ${requestNo}`);

  const sapHead = await database.collection("ZP_AISP_SES_HDR").findOne({ Ebeln });
  if (!sapHead) throw new Error(`ZP_AISP_SES_HDR not found for PO ${Ebeln}`);

  const { from_date, end_date } = formatSAPDate(sesHead.SERVICE_PERIOD || "");

  const sesItems = await database.collection("SES_ITEM").find({ REQUEST_NO: requestNo }).toArray();
  if (!sesItems.length) throw new Error(`No SES_ITEMs found for REQUEST_NO ${requestNo}`);

  const results = sesItems.map((item, index) => {
    const extrow = (parseInt(item.SR_NO) || index + 1) * 10;
    const introw = item.introw || (index + 1).toString();
    const packno = item.packno || introw;

    return {
      Ebeln,
      Ebelp: item.ITEM_NUMBER,
      packno,
      introw,
      packageNofromPO: item.packageNofromPO,
      extrow: extrow.toString(),
      srvpos: item.SERVICE_NUMBER,
      tbtwr: item.UNIT_PRICE.toString(),
      netwr: item.TOTAL_PRICE.toString(),
      meins: item.UNIT_OF_MEASURE,
      act_menge: item.SERVICE_QUANTITY.toString()
    };
  });

  return {
    Ebeln,
    Bukrs: sapHead.Bukrs || "1000",
    ServicePOType: sapHead.ServicePOType || "Planned",
    person_res_intr: sapHead.person_res_intr || sesHead.PERSON_RESPONSIBLE || "",
    person_res_extr: sapHead.person_res_extr || sesHead.SITE_PERSON || "",
    location: sapHead.location || sesHead.SERVICE_LOCATION || "",
    short_text: sapHead.short_text || sesHead.SERVICE_TEXT || "",
    from_date,
    end_date,
    FIN_ENTRY: sapHead.FIN_ENTRY === "YES" ? "x" : "",
    to_sesitems: { results }
  };
}

async function fetchCsrfTokenn() {
  const { client, cookieJar } = await initClient();

  const baseURL = "http://airdithanaprd.airditsoftware.com:8010/sap/opu/odata/sap/ZP_AISP_SES_UPSES_SRB/ZP_AISP_SES_HDR";
  const username = "mahesh0348";
  const password = "Teachers50#";
  const authh = Buffer.from(`${username}:${password}`).toString('base64');

  const response = await client.get(baseURL, {
    headers: {
      'Authorization': `Basic ${authh}`,
      'Accept': 'application/json',
      'x-csrf-token': 'Fetch'
    }
  });

  const csrfToken = response.headers['x-csrf-token'];
  if (!csrfToken) {
    throw new Error("CSRF token not found in response.");
  }

  console.log("CSRF Token:", csrfToken);
  console.log("Cookies in jar:", await cookieJar.getCookieString(baseURL));

  return { csrfToken, authh };
}

async function sendPostPayloadToSAPforSES(requestNo) {
  await initClient(); // ✅ Ensure client is ready
  const { database } = await getConnection();
  const SES_ENDPOINT = "http://airdithanaprd.airditsoftware.com:8010/sap/opu/odata/sap/ZP_AISP_SES_UPSES_SRB/ZP_AISP_SES_HDR";

  try {
    const payload = await buildSESPayloadForSAP(requestNo);

    const { csrfToken, authh } = await fetchCsrfTokenn();

    const response = await client.post(
      SES_ENDPOINT,
      payload,
      {
        headers: {
          'x-csrf-token': csrfToken,
          'Authorization': `Basic ${authh}`,
          'Content-Type': 'application/json',
          'Accept': '*/*'
        }
      }
    );

    console.log("POST Response:", JSON.stringify(response.data, null, 2));

    const sapMessageHeader = response.headers['sap-message'];
    if (!sapMessageHeader) throw new Error('SAP message header is missing.');

    const parser = new xml2js.Parser();
    const parsedMessage = await parser.parseStringPromise(sapMessageHeader);
    const referenceNumber = parsedMessage?.notification?.message?.[0]?.match(/\d+/);

    if (!referenceNumber) {
      throw new Error('Reference number not found in SAP message.');
    }

    await database.collection("SES_BATCH_LOGS").insertOne({
      REQUEST_NO: requestNo,
      STATUS: "Posted",
      payload,
      sapResponse: response.data,
      timestamp: new Date()
    });

    return {
      status: "Success",
      referenceNumber: referenceNumber[0],
      response: response.data
    };

  } catch (error) {
    console.error("Error during SES POST:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    throw new Error(`Error during SES POST: ${error.message}`);
  }
}

module.exports = {
  buildSESPayloadForSAP,
  sendPostPayloadToSAPforSES
};
