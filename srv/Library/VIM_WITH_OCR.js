const { getConnection } = require("./DBConn");

//PO VIM WITH OCR :
async function sendPostPayloadToSAPforCreateVimWithOCR(REQUEST_NO) {
  const { client, database } = await getConnection();

  const headData = await database
    .collection("VIM_PO_HEAD_DATA_WITH_OCR")
    .findOne({ REQUEST_NO });
  const itemData = await database
    .collection("VIM_PO_ITEM_DATA_WITH_OCR")
    .find({ REQUEST_NO })
    .toArray();

  if (!headData || itemData.length === 0) {
    throw new Error(
      `No VIM_PO_HEAD_DATA or VIM_PO_ITEM_DATA found for REQUEST_NO: ${REQUEST_NO}`
    );
  }

  // const payload = {
  //   SupplierInvoice: "",  // Leave empty or fetch if needed
  //   FiscalYear: "2025",  // Hardcoded fiscal year
  //   CompanyCode: "1000",  // Hardcoded company code
  //   DocumentDate: "/Date(1758363803683)/",  // Hardcoded current date (example: 2025-09-25)
  //   PostingDate: "/Date(1758363803683)/",  // Hardcoded current date (example: 2025-09-25)
  //   InvoicingParty: "100000",  // Supplier number (LIFNR)
  //   DocumentCurrency: "INR",  // Currency code (WAERS)
  //   InvoiceGrossAmount: "19600.00",  // Total invoice amount
  //   PaymentTerms: "0001",  // Hardcoded payment terms
  //   SupplierInvoiceStatus: "5",  // Status code (Hardcoded)
  //   IndirectQuotedExchangeRate: "0.00000",  // Hardcoded indirect quoted exchange rate
  //   DirectQuotedExchangeRate: "1.00000",  // Hardcoded direct quoted exchange rate
  //   BusinessPlace: "AIRD",  // Business place (Hardcoded)
  //   IN_GSTPartner: "100000",  // Supplier number (LIFNR)
  //   IN_GSTPlaceOfSupply: "10",  // Hardcoded place of supply code
  //   IN_InvoiceReferenceNumber: "",  // Supplier's input reference number (Leave empty or fill as needed)
  //   to_SuplrInvcItemPurOrdRef: {
  //     results: [
  //       {
  //         SupplierInvoice: "",  // Leave empty or fetch if needed
  //         FiscalYear: "2025",  // Hardcoded fiscal year
  //         SupplierInvoiceItem: "1",  // Item number (Serial number)
  //         PurchaseOrder: "4500000340",  // Purchase order number
  //         PurchaseOrderItem: "10",  // Purchase order item
  //         Plant: "1000",  // Plant code (Check if correct)
  //         TaxCode: "G0",  // Tax code (Hardcoded)
  //         DocumentCurrency: "INR",  // Document currency (Hardcoded)
  //         SupplierInvoiceItemAmount: "9800.00",  // Total item amount
  //         PurchaseOrderQuantityUnit: "EA",  // Unit of measure (MEINS)
  //         QuantityInPurchaseOrderUnit: "100",  // Quantity in purchase order unit (Menge)
  //         PurchaseOrderPriceUnit: "EA",  // Purchase order price unit (Hardcoded)
  //         QtyInPurchaseOrderPriceUnit: "100",  // Quantity in purchase order price unit (NETPR / NETWR)
  //         ProductType: "1"  // Product type (Hardcoded)
  //       }
  //     ]
  //   }
  // };

  const payload = {
    SupplierInvoice: "", //blank always
    FiscalYear: "2025",
    CompanyCode: headData?.COMPANY_CODE || "",
    DocumentDate: `/Date(${new Date().getTime()})/`,
    PostingDate: `/Date(${new Date().getTime()})/`,
    InvoicingParty: headData?.SUPPLIER_NUMBER || "",
    DocumentCurrency: headData?.CURRENCY || "",
    InvoiceGrossAmount: headData?.INVOICE_AMOUNT || "",
    PaymentTerms: "0001",
    SupplierInvoiceStatus: "5",
    IndirectQuotedExchangeRate: "0.00000",
    DirectQuotedExchangeRate: "1.00000",
    BusinessPlace: "AIRD",
    IN_GSTPartner: headData?.SUPPLIER_NUMBER || "",
    IN_GSTPlaceOfSupply: "10",
    IN_InvoiceReferenceNumber: headData?.INVOICE_NO || "",
    to_SuplrInvcItemPurOrdRef: {
      results: itemData.map((item) => ({
        SupplierInvoice: "",
        FiscalYear: "2025",
        SupplierInvoiceItem: item?.SR_NO || "",
        PurchaseOrder: headData?.PO_NUMBER || "",
        PurchaseOrderItem: item?.SR_NO || "",
        Plant: item?.PLANT || "",
        TaxCode: "G0",
        DocumentCurrency: headData?.CURRENCY || "",
        SupplierInvoiceItemAmount: item?.TOTAL_PRICE || "",
        PurchaseOrderQuantityUnit: "EA",
        QuantityInPurchaseOrderUnit: item?.ORDERED_QUANTITY || "",
        PurchaseOrderPriceUnit: "EA",
        QtyInPurchaseOrderPriceUnit: item?.UNIT_RATE || "",
        ProductType: "1",
      })),
    },
  };

  try {
    const ConERP = await cds.connect.to("s4p_https");
    const url = "/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice";

    const response = await ConERP.send({
      method: "POST",
      path: url,
      headers: {
        "Content-Type": "application/json",
        "sap-client": "200",
      },
      data: payload,
    });

    const supplierInvoice = response.d.SupplierInvoice;

    await database
      .collection("VIM_PO_HEAD_DATA_WITH_OCR")
      .updateOne(
        { REQUEST_NO },
        { $set: { supplierInvoiceRefNo: supplierInvoice } }
      );
    return { supplierInvoiceRefNo: supplierInvoice };
  } catch (err) {
    console.error("Detailed error message:", err.reason.message);
    return {
      error: "Error creating VIM in S/4HANA : Error ->> " + err.reason.message,
    };
  }
}

//PO VIM WITHOUT OCR :
async function sendPostPayloadToSAPforCreateVimWithOutOCR(REQUEST_NO) {
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
      `No VIM_PO_HEAD_DATA or VIM_PO_ITEM_DATA found for REQUEST_NO: ${REQUEST_NO}`
    );
  }

  // Sort items by Ebelp and renumber them sequentially as 2-digit numbers
  const sortedItems = itemData
    .sort((a, b) => parseInt(a.Ebelp) - parseInt(b.Ebelp))
    .map((item, index) => ({
      ...item,
      sequentialEbelp: String(index + 1).padStart(2, "0"), // Creates 01, 02, 03, etc.
    }));

  const payload = {
    SupplierInvoice: headData?.SUPPLIER_INVOICE || "",
    FiscalYear: "2025",
    CompanyCode: headData?.COMPANY_CODE || "",
    DocumentDate: `/Date(${new Date().getTime()})/`,
    PostingDate: `/Date(${new Date().getTime()})/`,
    InvoicingParty: headData?.Lifnr || "",
    DocumentCurrency: headData?.CURRENCY || "INR",
    InvoiceGrossAmount: headData?.TotalAmount || "",
    PaymentTerms: "0001",
    SupplierInvoiceStatus: "5",
    IndirectQuotedExchangeRate: "0.00000",
    DirectQuotedExchangeRate: "1.00000",
    BusinessPlace: "AIRD",
    IN_GSTPartner: headData?.Lifnr || "",
    IN_GSTPlaceOfSupply: "10",
    PaymentReference: headData?.Invoicerefno || "",
    to_SuplrInvcItemPurOrdRef: {
      results: sortedItems.map((item) => ({
        SupplierInvoice: "",
        FiscalYear: "2025",
        SupplierInvoiceItem: item.sequentialEbelp,
        PurchaseOrder: item?.Ebeln || "",
        PurchaseOrderItem: item.Ebelp,
        Plant: item?.PLANT || "",
        TaxCode: "G0",
        DocumentCurrency: headData?.CURRENCY || "INR",
        SupplierInvoiceItemAmount: item?.Total.toString() || null,
        PurchaseOrderQuantityUnit: item?.Meins,
        QuantityInPurchaseOrderUnit: item?.Menge || "",
        PurchaseOrderPriceUnit: item?.Meins,
        QtyInPurchaseOrderPriceUnit: item?.Taxper.toString() || null,
        ProductType: "1",
      })),
    },
  };

  try {
    const ConERP = await cds.connect.to("s4p_https");
    const url = "/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice";

    const response = await ConERP.send({
      method: "POST",
      path: url,
      headers: {
        "Content-Type": "application/json",
        "sap-client": "200",
      },
      data: payload,
    });

    const supplierInvoice = response.d.SupplierInvoice;

    await database
      .collection("VIM_HEAD_DATA")
      .updateOne(
        { REQUEST_NO },
        { $set: { supplierInvoiceRefNo: supplierInvoice } }
      );
    return { supplierInvoiceRefNo: supplierInvoice };
  } catch (err) {
    console.error("Detailed error message:", err.reason.message);
    return {
      error: "Error creating VIM in S/4HANA : Error ->> " + err.reason.message,
    };
  }
}

//NON PO-VIM WITH OCR :
async function sendPostPayloadToSAPforCreateNPOInvoice(REQUEST_NO) {
  const { client, database } = await getConnection();

  const headData = await database
    .collection("VIM_NPO_HEAD_DATA")
    .findOne({ REQUEST_NO });
  const itemData = await database
    .collection("VIM_NPO_ITEM_DATA")
    .find({ REQUEST_NO })
    .toArray();

  if (!headData || itemData.length === 0) {
    throw new Error(
      `No VIM_NPO_HEAD_DATA or VIM_NPO_ITEM_DATA found for REQUEST_NO: ${REQUEST_NO}`
    );
  }

  const payload = {
    CompanyCode: headData?.COMPANY_CODE || "1000",
    DocumentDate: `/Date(${new Date().getTime()})/`,
    PostingDate: `/Date(${new Date().getTime()})/`,
    SupplierInvoiceIDByInvcgParty: headData?.INVOICE_NUMBER || "",
    InvoicingParty: "100000",
    DocumentCurrency: headData?.CURRENCY || "INR",
    SupplierInvoiceStatus: "5",
    InvoiceGrossAmount: String(headData?.TOTAL_AMOUNT || ""),
    TaxIsCalculatedAutomatically: false,
    BusinessPlace: "AIRD",
    AccountingDocumentType: "KR",
    to_SupplierInvoiceItemGLAcct: itemData.map((item, index) => ({
      SupplierInvoiceItem: String(item.SR_NO || ""),
      DocumentCurrency: headData?.CURRENCY || "INR",
      DebitCreditCode: "S",
      SupplierInvoiceItemAmount: String(item?.PRICE || ""),
      GLAccount: "0000400005",
      CostCenter: "1000",
      TaxCode: "G0",
    })),
    to_SupplierInvoiceTax: [
      {
        TaxAmount: "0",
        DocumentCurrency: headData?.CURRENCY || "INR",
        TaxCode: "G0",
      },
    ],
  };

  try {
    const ConERP = await cds.connect.to("s4p_https");
    const url = "/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice";

    const response = await ConERP.send({
      method: "POST",
      path: url,
      headers: {
        "Content-Type": "application/json",
        "sap-client": "200",
      },
      data: payload,
    });

    const supplierInvoice = response.d.SupplierInvoice;

    await database
      .collection("VIM_NPO_HEAD_DATA")
      .updateOne(
        { REQUEST_NO },
        { $set: { supplierInvoiceRefNo: supplierInvoice } }
      );
    return { supplierInvoiceRefNo: supplierInvoice };
  } catch (err) {
    console.error("Detailed error message:", err.reason.message);
    return {
      error: "Error creating NPO invoice in SAP: " + err.reason.message,
    };
  }
}

//ASN CREATION:-
async function createASNBatch({ asnHead, asnItems, DeliveryDate }) {
  const { client, database } = await getConnection();

  const shipmentDetails = asnHead[0]?.ShipmentDetails[0] || {};
  const transportDetails = asnHead[0]?.TransportDetails[0] || {};

  if (!asnItems || asnItems.length === 0) {
    throw new Error("No ASN items found for processing.");
  }

  const asnHeaderPayload = {
    DeliveryDate: `/Date(${new Date().getTime()})/`,
    to_DeliveryDocumentItem: {
      results: asnItems.map((item) => ({
        ReferenceSDDocument: item.Ebeln, // PO Number
        ReferenceSDDocumentItem: item.Ebelp, // PO Item
        ActualDeliveryQuantity: item.Deliveryqty, // Quantity
      })),
    },
  };

  try {
    const ConERP = await cds.connect.to("s4p_https");
    const url = "/API_INBOUND_DELIVERY_SRV;v=0002/A_InbDeliveryHeader";

    const response = await ConERP.send({
      method: "POST",
      path: url,
      headers: {
        "Content-Type": "application/json",
        "sap-client": "200",
      },
      data: asnHeaderPayload,
    });

    const inboundDelivery = response.d.DeliveryDocument || null;
    
    console.log("ASN Number:", inboundDelivery);

    const updateTransportData = await storeTransportData(
      shipmentDetails,
      transportDetails,
      inboundDelivery,
      asnItems
    );

    return { deliveryNumber: inboundDelivery };
  } catch (err) {
    console.error("Detailed error message:", err.reason.message);
    return {
      error: "Error creating ASN in S/4HANA: Error ->> " + err.reason.message,
    };
  }
}

async function storeTransportData(
  shipmentDetails,
  transportDetails,
  inboundDelivery,
  asnItems
) {
  const { client, database } = await getConnection();
  const doc = {
    Ebeln: asnItems[0]?.Ebeln,
    Vbeln: inboundDelivery || null,
    ShipmentDetails: {
      trackingNumber: shipmentDetails?.trackingNumber,
      originLocation: shipmentDetails?.originLocation,
      destinationLocation: shipmentDetails?.destinationLocation,
      scheduledShipmentDate: shipmentDetails?.scheduledShipmentDate
        ? new Date(shipmentDetails.scheduledShipmentDate)
        : undefined,
      expectedDeliveryDate: shipmentDetails?.expectedDeliveryDate
        ? new Date(shipmentDetails.expectedDeliveryDate)
        : undefined,
      ShipmentWeight: shipmentDetails?.ShipmentWeight,
    },
    TransportDetails: {
      carrierName: transportDetails?.carrierName,
      transportMode: transportDetails?.transportMode,
      driverName: transportDetails?.driverName,
      driverWhatsappNumber: transportDetails?.driverWhatsappNumber,
      vehicleNumber: transportDetails?.vehicleNumber,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ShipmentAndTransportCol = database.collection(
    "ZP_ASN_SHIPMENT_TRANSPORT_DATA"
  );

  await ShipmentAndTransportCol.insertOne(doc);
}

module.exports = {
  sendPostPayloadToSAPforCreateVimWithOCR,
  sendPostPayloadToSAPforCreateVimWithOutOCR,
  sendPostPayloadToSAPforCreateNPOInvoice,
  createASNBatch,
};
