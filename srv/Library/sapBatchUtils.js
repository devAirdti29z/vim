// Create ASN ---------------------------------------------------------------------------START
const fetch = require("node-fetch");
const { getConnection } = require("./DBConn");
const axios = require("axios");
const xml2js = require("xml2js");

const baseURL =
  "http://airdithanaprd.airditsoftware.com:8010/sap/opu/odata/sap/ZP_MM_ASNPOHEAD_BND";
const username = "BHABANI0366";
const password = "Bhabani0366";
const auth = Buffer.from(`${username}:${password}`).toString("base64");

async function fetchCsrfToken() {
  const response = await fetch(baseURL, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "X-CSRF-Token": "Fetch",
    },
  });

  const token = response.headers.get("x-csrf-token");
  const cookies = response.headers.get("set-cookie");
  const cookieHeader = cookies
    ? cookies
        .split(",")
        .map((c) => c.trim())
        .join("; ")
    : "";

  if (!token) throw new Error("Failed to fetch CSRF token");

  return { token, cookieHeader };
}

function buildBatchBody(asnItems, deliveryDateStr) {

  if (!asnItems || asnItems.length === 0) {
    throw new Error("No ASN items provided for the batch request.");
  }

  const boundary = `batch_${Date.now()}`;
  const changeset11 = `changeset_${Date.now()}_put`;
  const changeset13 = `changeset_${Date.now()}_post`;

  const deliveryDate = new Date().toISOString();
  const timestamp = new Date(deliveryDate).getTime();
  const formattedDeliveryDate = `/Date(${timestamp})/`;

  let body = `--${boundary}\r\nContent-Type: multipart/mixed; boundary=${changeset11}\r\n\r\n`;

  asnItems.forEach((item) => {
    const {
      Ebeln,
      Ebelp,
      Txz01,
      Matnr,
      Menge,
      Pendingqty,
      Deliveryqty,
      Meins,
    } = item;

    body += `--${changeset11}\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\n`;
    body += `PUT ZP_MM_ASNPOITEM(Ebeln='${Ebeln}',Ebelp='${Ebelp}') HTTP/1.1\r\nContent-Type: application/json\r\n\r\n`;
    body +=
      JSON.stringify({
        Ebeln,
        Ebelp,
        Txz01,
        Matnr,
        Menge,
        Pendingqty,
        Deliveryqty,
        Meins,
      }) + `\r\n`;
  });

  body += `--${changeset11}--\r\n`;

  body += `--${boundary}\r\nContent-Type: multipart/mixed; boundary=${changeset13}\r\n\r\n`;
  body += `--${changeset13}\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\n`;
  body += `POST ZP_MM_ASNPOITEM(Ebeln='${asnItems[0].Ebeln}',Ebelp='${asnItems[0].Ebelp}')/to_shipheaddet HTTP/1.1\r\nContent-Type: application/json\r\n\r\n`;
  body += JSON.stringify({ Deliverydate: formattedDeliveryDate }) + `\r\n`;
  body += `--${changeset13}--\r\n`;

  body += `--${boundary}--`;

  return { body, boundary };
}

//CREATE VIM PO-BASED FINAL APPROVAL--------------------->>>START
const baseURLFORVIM =
  "http://airdithanaprd.airditsoftware.com:8010/sap/opu/odata/sap/ZP_AISP_POVIM_HEAD_BND";

async function getCSRFTokenAndCookies() {
  const response = await fetch(baseURLFORVIM, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "X-CSRF-Token": "Fetch",
    },
  });

  const token = response.headers.get("x-csrf-token");
  const cookies = response.headers.raw()["set-cookie"];

  if (!token || !cookies)
    throw new Error("Failed to fetch CSRF token or cookies");

  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");

  return {
    csrfToken: token,
    cookies: cookieHeader,
  };
}

function buildBatchPayload(vimHead, vimItems, sapClient = "200") {
  const boundary = "batch_boundary";
  const changeset = "changeset_1";
  let payload = `--${boundary}\nContent-Type: multipart/mixed; boundary=${changeset}\n\n`;

  vimItems.forEach((item) => {
    const payloadBody = {
      Ebeln: item.Ebeln,
      Vbeln: item.Vbeln,
      Ebelp: item.Ebelp,
      menge: item.Menge.toString(),
      waers: "INR",
      meins: "EA",
      Total: item.Total,
      Invoicerefno: item.Invoicerefno,
      Invoicedate: `/Date(${new Date(item.Invoicedate).getTime()})/`,
    };

    payload += `--${changeset}\n`;
    payload += `Content-Type: application/http\nContent-Transfer-Encoding: binary\n\n`;
    payload += `POST ZP_AISP_POVIM_HEAD(Ebeln='${vimHead.Ebeln}',vbeln='${vimHead.Vbeln}')/to_povimitm?sap-client=${sapClient} HTTP/1.1\n`;
    payload += `Accept: application/json\nContent-Type: application/json\n\n`;
    payload += `${JSON.stringify(payloadBody)}\n\n`;
  });

  payload += `--${changeset}--\n--${boundary}--`;

  return { payload, boundary };
}

function extractSAPMessagesFromBatch(rawText) {
  const messages = [];
  const regex = /sap-message: (.*?)\r?\n/gs;

  let match;
  while ((match = regex.exec(rawText)) !== null) {
    try {
      messages.push(JSON.parse(match[1]));
    } catch (err) {
      console.warn("⚠️ Could not parse sap-message:", match[1]);
    }
  }
  return messages;
}

function extractSAPErrorsFromBatch(rawText) {
  const errors = [];

  // Try to match any JSON-like block that contains an "error" field
  const possibleJsons = rawText
    .split("\n")
    .filter((line) => line.trim().startsWith("{") && line.includes('"error"'));

  for (const block of possibleJsons) {
    try {
      const parsed = JSON.parse(block);
      if (parsed?.error?.message?.value) {
        errors.push(parsed.error.message.value);
      } else if (parsed?.error?.message) {
        errors.push(parsed.error.message);
      } else {
        errors.push(JSON.stringify(parsed));
      }
    } catch (err) {
      console.warn("⚠️ Could not JSON parse SAP error block:", block);
    }
  }

  return errors;
}

async function sendPostPayloadToSAPforCreateVim(REQUEST_NO) {
  const { client, database } = await getConnection();
  const headData = await database
    .collection("VIM_HEAD_DATA")
    .findOne({ REQUEST_NO });
  const itemData = await database
    .collection("VIM_ITEM_DATA")
    .find({ REQUEST_NO })
    .toArray();

  if (!headData || itemData.length === 0) {
    throw new Error(
      `No VIM_HEAD_DATA or VIM_ITEM_DATA found for REQUEST_NO: ${REQUEST_NO}`
    );
  }

  const { payload, boundary } = buildBatchPayload(headData, itemData);
  const { csrfToken, cookies } = await getCSRFTokenAndCookies();

  const response = await axios.post(
    `http://airdithanaprd.airditsoftware.com:8010/sap/opu/odata/sap/ZP_AISP_POVIM_HEAD_BND/$batch`,
    payload,
    {
      headers: {
        "x-csrf-token": csrfToken,
        Cookie: cookies,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
        Accept: "application/json",
      },
    }
  );

  if (response.status >= 400) {
    throw new Error(
      `SAP responded with HTTP ${response.status}: ${response.data}`
    );
  }
  const rawText = response.data;
  const sapMessages = extractSAPMessagesFromBatch(rawText);
  const sapErrors = extractSAPErrorsFromBatch(rawText);

  console.log("sapMessages →", sapMessages);
  console.log("sapErrors →", sapErrors);

  // Optional: Store in DB
  await database.collection("VIM_BATCH_LOGS").insertOne({
    REQUEST_NO,
    STATUS: "BatchRequestSent",
    payload,
    response: response.data,
    timestamp: new Date(),
  });

  return { sapErrors, sapMessages, rawText };
}

//CREATE SES-VIM  INVOICES ---------------------------------------------------START
const baseURLFOR_SES_VIM =
  "http://airdithanaprd.airditsoftware.com:8010/sap/opu/odata/sap/ZP_AISP_SESVIM_HEAD_BND";

async function getCSRFTokenAndCookies() {
  const response = await fetch(baseURLFOR_SES_VIM, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "X-CSRF-Token": "Fetch",
    },
  });

  const token = response.headers.get("x-csrf-token");
  const cookies = response.headers.raw()["set-cookie"];
  if (!token || !cookies)
    throw new Error("Failed to fetch CSRF token or cookies");

  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  return { csrfToken: token, cookies: cookieHeader };
}

function buildBatchPayloadForSESVIM(
  SESvimHead,
  SESvimItems,
  sapClient = "200"
) {
  const boundary = "batch_boundary";
  const changeset = "changeset_1";
  let payload = `--${boundary}\nContent-Type: multipart/mixed; boundary=${changeset}\n\n`;

  SESvimItems.forEach((item) => {
    const payloadBody = {
      Lblni: item.SES_NO, // SES Number
      Ebeln: item.PO_NUMBER, // PO Number
      Ebelp: "10", // PO Item (hardcoded)
      Lwert: item.SES_AMOUNT.toString(), // Amount
      Waers: "INR", // Currency
      Budat: `/Date(${new Date(item.SES_DATE).getTime()})/`, // Date
      Xblnr: SESvimHead.INVOICE_NUMBER, // Invoice Reference
    };

    payload += `--${changeset}\n`;
    payload += `Content-Type: application/http\nContent-Transfer-Encoding: binary\n\n`;
    payload += `POST ZP_AISP_SESVIM_HEAD('${item.PO_NUMBER}')/to_sesvimitm?sap-client=${sapClient} HTTP/1.1\n`;
    payload += `Accept: application/json\nContent-Type: application/json\n\n`;
    payload += `${JSON.stringify(payloadBody)}\n\n`;
  });

  payload += `--${changeset}--\n--${boundary}--`;

  return { payload, boundary };
}

function extractSAPMessagesFromBatch(rawText) {
  const messages = [];
  const regex = /sap-message: (.*?)\r?\n/gs;
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    try {
      messages.push(JSON.parse(match[1]));
    } catch (err) {
      console.warn("⚠️ Could not parse sap-message:", match[1]);
    }
  }
  return messages;
}

function extractSAPErrorsFromBatch(rawText) {
  const errors = [];
  const possibleJsons = rawText
    .split("\n")
    .filter((line) => line.trim().startsWith("{") && line.includes('"error"'));
  for (const block of possibleJsons) {
    try {
      const parsed = JSON.parse(block);
      if (parsed?.error?.message?.value) {
        errors.push(parsed.error.message.value);
      } else if (parsed?.error?.message) {
        errors.push(parsed.error.message);
      } else {
        errors.push(JSON.stringify(parsed));
      }
    } catch (err) {
      console.warn("⚠️ Could not JSON parse SAP error block:", block);
    }
  }
  return errors;
}

async function sendPostPayloadToSAPforSESVim(REQUEST_NO) {
  const { client, database } = await getConnection();

  const SESvimHead = await database
    .collection("SES_VIM_HEAD_DATA")
    .findOne({ REQUEST_NO });
  const SESvimItems = await database
    .collection("SES_VIM_ITEM_DATA")
    .find({ REQUEST_NO })
    .toArray();
  if (!SESvimHead || SESvimItems.length === 0) {
    throw new Error(
      `No SES VIM HEAD or ITEM data found for REQUEST_NO: ${REQUEST_NO}`
    );
  }

  const { payload, boundary } = buildBatchPayloadForSESVIM(
    SESvimHead,
    SESvimItems
  );

  const { csrfToken, cookies } = await getCSRFTokenAndCookies();

  const response = await axios.post(`${baseURLFOR_SES_VIM}/$batch`, payload, {
    headers: {
      "x-csrf-token": csrfToken,
      Cookie: cookies,
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
      Accept: "application/json",
    },
  });

  const rawText = response.data;
  const sapMessages = extractSAPMessagesFromBatch(rawText);
  const sapErrors = extractSAPErrorsFromBatch(rawText);

  await database.collection("SES_VIM_BATCH_LOGS").insertOne({
    REQUEST_NO,
    STATUS: "BatchRequestSent",
    payload,
    response: rawText,
    timestamp: new Date(),
  });

  return { sapMessages, sapErrors, rawText };
}

//END SES-VIM-------------------------------------------------------------------END

module.exports = {
  sendPostPayloadToSAPforCreateVim,
  sendPostPayloadToSAPforSESVim,
};
