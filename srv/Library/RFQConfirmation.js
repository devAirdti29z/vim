const cds = require("@sap/cds");
const { getConnection } = require("./DBConn");
const { errors } = require("@sap/xssec");
const axios = require("axios");

function todayISOForS4(timeZone = "Asia/Kolkata") {
  // -> "YYYY-MM-DDT00:00:00" in IST
  const d = new Date();
  const ymd = d.toLocaleDateString("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${ymd}T00:00:00`;
}

const createSupplierQuotationInS4 = async ({ RfqNumber, Bidder }) => {
  const submissionISO = todayISOForS4();

  // Build the OData function-import URL exactly like your working sample
  const s4Url =
    "http://103.194.234.17:8010/sap/opu/odata/sap/API_QTN_PROCESS_SRV/A_SupplierQuotation";
  const username = "MAHESH0348";
  const password = "Teachers50#";

  try {
    const csrfResp = await axios.get(s4Url, {
      auth: { username, password },
      headers: {
        "x-csrf-token": "fetch",
        Accept: "application/json",
      },
    });

    const csrfToken = csrfResp.headers["x-csrf-token"];
    const cookies = csrfResp.headers["set-cookie"];

    // const params = {
    //     QuotationSubmissionDate: `datetime'${submissionISO}'`,
    //     Supplier: `'${Bidder}'`,
    //     RequestForQuotation: `'${RfqNumber}'`
    // };

    // const res = await axios.post(url, {
    //     auth: { username, password },
    //     headers: {
    //         "x-csrf-token": csrfToken,
    //         "cookie": cookies,
    //         "Content-Type": "application/json",
    //         "Accept": "application/json"
    //     }
    // });

    const url = `http://103.194.234.17:8010/sap/opu/odata/sap/API_QTN_PROCESS_SRV/CreateFromRFQ?QuotationSubmissionDate=datetime'${submissionISO}'&Supplier='${Bidder}'&RequestForQuotation='${RfqNumber}'`;

    const postResp = await axios.post(url, null, {
      auth: { username, password },
      headers: {
        "x-csrf-token": csrfToken,
        cookie: cookies,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // OData V2 typical shapes:
    // 1) { d: { CreateFromRFQ: { SupplierQuotation: "8000000075", ... } } }
    // 2) { d: { SupplierQuotation: "8000000075" } }
    // 3) V4-ish: { SupplierQuotation: "8000000075" }

    const d = postResp.data?.d;
    const node = d?.CreateFromRFQ;
    const sq = node?.SupplierQuotation;
    if (!sq)
      throw new Error(
        `Missing SupplierQuotation. Body: ${JSON.stringify(res.data)}`
      );
    return sq;
  } catch (error) {
    const sapMsg = error?.response?.data?.error?.message?.value;
    throw {
      message: "Error changing status of RFQ in S/4HANA : Error ->> " + sapMsg,
    };
  }
};

const updateQuotationItemsInS4 = async ({
  SupplierQuotation,
  ItemNumber,
  NetPriceAmount,
}) => {
  // Build the OData function-import URL exactly like your working sample
  const s4Url =
    "http://103.194.234.17:8010/sap/opu/odata/sap/API_QTN_PROCESS_SRV/A_SupplierQuotation";
  const username = "MAHESH0348";
  const password = "Teachers50#";

  try {
    // Fetch CSRF token
    const csrfResp = await axios.get(s4Url, {
      auth: { username, password },
      headers: {
        "x-csrf-token": "fetch",
        Accept: "application/json",
      },
    });

    const csrfToken = csrfResp.headers["x-csrf-token"];
    const cookies = csrfResp.headers["set-cookie"];

    // Define the URL for the item update
    const url = `http://103.194.234.17:8010/sap/opu/odata/sap/API_QTN_PROCESS_SRV/A_SupplierQuotationItem(SupplierQuotation='${SupplierQuotation}',SupplierQuotationItem='${ItemNumber}')`;

    // Payload to update NetPriceAmount
    const payload = {
      NetPriceAmount: NetPriceAmount.toString(),
    };

    // Perform the update call
    const postResp = await axios.patch(url, payload, {
      auth: { username, password },
      headers: {
        "x-csrf-token": csrfToken,
        cookie: cookies,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    return postResp?.status;
  } catch (error) {
    const sapMsg = error?.response?.data?.error?.message?.value;
    throw { message: "Error creating supplier in S/4HANA: " + sapMsg };
  }
};

//Create Quotation Against RFQ
const createQuotationAgainstRFQInS4HANA = async (SupplierQuotation) => {
  // Build the OData function-import URL exactly like your working sample
  const s4Url =
    "http://103.194.234.17:8010/sap/opu/odata/sap/API_QTN_PROCESS_SRV/A_SupplierQuotation";
  const username = "BHABANI0366";
  const password = "Bhabani0366";

  try {
    // Fetch CSRF token
    const csrfResp = await axios.get(s4Url, {
      auth: { username, password },
      headers: {
        "x-csrf-token": "fetch",
        Accept: "application/json",
      },
    });

    const csrfToken = csrfResp.headers["x-csrf-token"];
    const cookies = csrfResp.headers["set-cookie"];

    // Define the URL for the item update
    const url = `http://103.194.234.17:8010/sap/opu/odata/sap/API_QTN_PROCESS_SRV/Submit?SupplierQuotation='${SupplierQuotation}'`;

    // Perform the update call
    const postResp = await axios.post(url, null, {
      auth: { username, password },
      headers: {
        "x-csrf-token": csrfToken,
        cookie: cookies,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const data = postResp.data?.d;
    const node = data?.Submit;
    const QTNLifecycleStatus = node?.QTNLifecycleStatus;
    if (!QTNLifecycleStatus)
      throw new Error(
        `Missing QTNLifecycleStatus. Body: ${JSON.stringify(postResp.data)}`
      );
    return QTNLifecycleStatus;
  } catch (error) {
    const sapMsg = error?.response?.data?.error?.message?.value;
    throw { message: "Error creating RFQ in S/4HANA: " + sapMsg };
  }
};

//Create RFQ
const createRFQInS4 = async (oPayload) => {
  try {
    console.clear();
    console.log(oPayload);
    const ConERP = await cds.connect.to("s4p_https");
    const url = "/API_RFQ_PROCESS_SRV/A_RequestForQuotation";
    const options = {
      headers: {
        "Content-Type": "application/json",
        // "sap-client": "120",
      },
    };

    const oData = {
      "RequestForQuotation": "",
      "CompanyCode": "1000",
      "PurchasingDocumentCategory": "R",
      "PurchasingDocumentType": "RQ",
      "CreatedByUser": "SHIVA0427",
      "CreationDate": "/Date(1764237779920)/",
      "LastChangeDateTime": "/Date(1764237779920)/",
      "Language": "EN",
      "PurchasingOrganization": "1100",
      "PurchasingGroup": "P01",
      "DocumentCurrency": "INR",
      "IncotermsClassification": "",
      "IncotermsTransferLocation": "",
      "IncotermsVersion": "",
      "IncotermsLocation1": "",
      "IncotermsLocation2": "",
      "PaymentTerms": "",
      "CashDiscount1Days": "0",
      "CashDiscount2Days": "0",
      "CashDiscount1Percent": "0.000",
      "CashDiscount2Percent": "0.000",
      "NetPaymentDays": "0",
      "RFQPublishingDate": "/Date(1764237779920)/",
      "QuotationLatestSubmissionDate": "/Date(1766016000000)/",
      "TargetAmount": "1000.00",
      "CorrespncInternalReference": "",
      "RFQLifecycleStatus": "02",
      "RequestForQuotationName": "TEST RFQ Project",
      "QuotationEarliestSubmsnDate": null,
      "FollowOnDocumentCategory": "F",
      "FollowOnDocumentType": "NB",
      "IsEndOfPurposeBlocked": "",
      "to_RequestForQuotationItem": [
        {
          "RequestForQuotationItem": "1",
          "RequestForQuotation": "",
          "PurchasingDocumentCategory": "R",
          "PurchasingDocumentItemText": "Mouse",
          "Material": "101000000000000308",
          "ManufacturerMaterial": "11",
          "ManufacturerPartNmbr": "",
          "Manufacturer": "",
          "MaterialGroup": "002",
          "Plant": "1000",
          "ManualDeliveryAddressID": "",
          "ReferenceDeliveryAddressID": "",
          "IncotermsClassification": "",
          "IncotermsTransferLocation": "",
          "IncotermsLocation1": "",
          "IncotermsLocation2": "",
          "ScheduleLineOrderQuantity": "1",
          "OrderQuantityUnit": "PC",
          "OrderItemQtyToBaseQtyNmrtr": "1",
          "OrderItemQtyToBaseQtyDnmntr": "1",
          "BaseUnit": "EA",
          "ScheduleLineDeliveryDate": "/Date(1766707200000)/",
          "PurchaseRequisition": "",
          "PurchaseRequisitionItem": "0",
          "IsInfoRecordUpdated": false
        },
        {
          "RequestForQuotationItem": "2",
          "RequestForQuotation": "",
          "PurchasingDocumentCategory": "R",
          "PurchasingDocumentItemText": "LAPTOP",
          "Material": "101000000000000352",
          "ManufacturerMaterial": "11",
          "ManufacturerPartNmbr": "",
          "Manufacturer": "",
          "MaterialGroup": "002",
          "Plant": "1000",
          "ManualDeliveryAddressID": "",
          "ReferenceDeliveryAddressID": "",
          "IncotermsClassification": "",
          "IncotermsTransferLocation": "",
          "IncotermsLocation1": "",
          "IncotermsLocation2": "",
          "ScheduleLineOrderQuantity": "1",
          "OrderQuantityUnit": "PC",
          "OrderItemQtyToBaseQtyNmrtr": "1",
          "OrderItemQtyToBaseQtyDnmntr": "1",
          "BaseUnit": "EA",
          "ScheduleLineDeliveryDate": "/Date(1766707200000)/",
          "PurchaseRequisition": "",
          "PurchaseRequisitionItem": "0",
          "IsInfoRecordUpdated": false
        }
      ],
      "to_RequestForQuotationBidder": [
        {
          "RequestForQuotation": "",
          "PartnerCounter": "1",
          "PartnerFunction": "BI",
          "Supplier": "100000"
        },
        {
          "RequestForQuotation": "",
          "PartnerCounter": "1",
          "PartnerFunction": "BI",
          "Supplier": "1000000010"
        }
      ]
    }

    const response = await ConERP.send({
      method: "POST",
      path: url,
      headers: {
        "Content-Type": "application/json",
      },
      data: oData,
    });

    console.log("RFQ create --->>>" + response.d.RequestForQuotation);

    return response.d.RequestForQuotation;
  } catch (error) {
    console.warn(error);
    const sapMsg = error?.message;
    throw { message: "Error creating RFQ in S/4HANA: " + sapMsg };
  }
};

//Award Supplier Against RFQ
const AwardSupplierAgainstRFQ = async (SupplierQuotation) => {
  try {
    const ConERP = await cds.connect.to("s4p_https");
    const url =
      `/API_QTN_PROCESS_SRV/SubmitForApproval?SupplierQuotation='${SupplierQuotation}'`;
    const options = {
      headers: {
        "Content-Type": "application/json",
        "sap-client": "120",
      },
    };

    const response = await ConERP.send({
      method: "POST",
      path: url,
      headers: {
        "Content-Type": "application/json",
      }
    });

    console.log("RFQ Award --->>>" + response);

    return response.d.SubmitForApproval;
  } catch (error) {
    console.warn(error);
    const sapMsg = error?.message;
    throw { message: "Error creating RFQ in S/4HANA: " + sapMsg };
  }
};

module.exports = {
  createQuotationAgainstRFQInS4HANA,
  updateQuotationItemsInS4,
  createSupplierQuotationInS4,
  createRFQInS4,
  AwardSupplierAgainstRFQ,
};
