const cds = require('@sap/cds');
const axios = require('axios');
const { getConnection } = require("./Library/DBConn");
const { v4: uuidv4 } = require("uuid");
const { getAllDestinationsFromDestinationService } = require("@sap-cloud-sdk/connectivity");
const dbHandler = require('./helper/helper');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const {
  mongoRead,
  handleCRUD
} = require("../Library/mongo-helper");


const MONGO_URI = 'mongodb+srv://Vaibhav:D7tY3V0VTWi5Am0w@aisp.smrk0zv.mongodb.net/';
const DB_NAME = 'VendorPortal-Airdit';



let db;

module.exports = cds.service.impl(async function() {
    const { POHeaders,PODispatchAddresses,PODispatchItems, POItems } = this.entities;
    try {
    const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }

  /*POHeaders*/

this.on("CREATE", POHeaders, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_HEADERS");

    const payload = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      PlantDescription: req.data.PlantDescription || "",
      PlantAddress: req.data.PlantAddress || "",
      CreationDate: req.data.CreationDate || null,
      SupplierName: req.data.SupplierName || "",
      SupplierCode: req.data.SupplierCode || "",
      SupplierAddress: req.data.SupplierAddress || "",
      SupplierEmail: req.data.SupplierEmail || "",
      createdAt: new Date().toISOString()
    };

    await collection.insertOne(payload);
    return payload;

  } catch (err) {
    console.error("Error creating POHeader:", err);
    return req.reject(500, "Failed to create POHeader");
  }
});

  this.on("READ", POHeaders, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_HEADERS");

    const filters = req.query?.SELECT?.where || [];
    const query = await buildMongoFilter(filters, req);

    const data = await collection.find(query).toArray();
    data["$count"] = data.length;

    return data;
  } catch (err) {
    console.error("Error reading POHeaders:", err);
    return req.reject(500, "Failed to read POHeaders");
  }
});

this.on("UPDATE", POHeaders, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_HEADERS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode
    };

    const existing = await collection.findOne(key);
    if (!existing) return req.reject(404, "POHeader not found");

    const updateFields = {
      ...req.data,
      modifiedAt: new Date().toISOString()
    };

    await collection.updateOne(key, { $set: updateFields });
    return { ...key, ...updateFields };

  } catch (err) {
    console.error("Error updating POHeader:", err);
    return req.reject(500, "Failed to update POHeader");
  }
});

this.on("DELETE", POHeaders, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_HEADERS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode
    };

    const result = await collection.deleteOne(key);
    if (!result.deletedCount) return req.reject(404, "POHeader not found");

    return { message: "POHeader deleted successfully" };

  } catch (err) {
    console.error("Error deleting POHeader:", err);
    return req.reject(500, "Failed to delete POHeader");
  }
});

/*POItems*/
this.on("CREATE", POItems, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_ITEMS");

    const payload = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      ItemNumber: req.data.ItemNumber,
      Material: req.data.Material || "",
      MaterialDescription: req.data.MaterialDescription || "",
      UnitOfMeasure: req.data.UnitOfMeasure || "",
      OrderedQuantity: req.data.OrderedQuantity || 0,
      createdAt: new Date().toISOString()
    };

    await collection.insertOne(payload);
    return payload;

  } catch (err) {
    console.error("Error creating POItem:", err);
    return req.reject(500, "Failed to create POItem");
  }
});

this.on("READ", POItems, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_ITEMS");

    const filters = req.query?.SELECT?.where || [];
    const query = await buildMongoFilter(filters, req);

    const data = await collection.find(query).toArray();
    data["$count"] = data.length;

    return data;
  } catch (err) {
    console.error("Error reading POItems:", err);
    return req.reject(500, "Failed to read POItems");
  }
});

this.on("UPDATE", POItems, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_ITEMS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      ItemNumber: req.data.ItemNumber
    };

    const existing = await collection.findOne(key);
    if (!existing) return req.reject(404, "POItem not found");

    await collection.updateOne(key, {
      $set: { ...req.data, modifiedAt: new Date().toISOString() }
    });

    return { ...key, ...req.data };

  } catch (err) {
    console.error("Error updating POItem:", err);
    return req.reject(500, "Failed to update POItem");
  }
});

this.on("DELETE", POItems, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_ITEMS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      ItemNumber: req.data.ItemNumber
    };

    const result = await collection.deleteOne(key);
    if (!result.deletedCount) return req.reject(404, "POItem not found");

    return { message: "POItem deleted successfully" };

  } catch (err) {
    console.error("Error deleting POItem:", err);
    return req.reject(500, "Failed to delete POItem");
  }
});

/*PODispatchAddresses*/

this.on("CREATE", PODispatchAddresses, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ADDR");

    const payload = {
      ...req.data,
      createdAt: new Date().toISOString()
    };

    await collection.insertOne(payload);
    return payload;

  } catch (err) {
    console.error("Error creating Dispatch Address:", err);
    return req.reject(500, "Failed to create Dispatch Address");
  }
});

this.on("READ", PODispatchAddresses, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ADDR");

    const filters = req.query?.SELECT?.where || [];
    const query = await buildMongoFilter(filters, req);

    const data = await collection.find(query).toArray();
    data["$count"] = data.length;

    return data;
  } catch (err) {
    console.error("Error reading PODispatchAddresses:", err);
    return req.reject(500, "Failed to read Dispatch Addresses");
  }
});

this.on("UPDATE", PODispatchAddresses, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ADDR");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      DispatchNumber: req.data.DispatchNumber,
      InvoiceBillTrack: req.data.InvoiceBillTrack
    };

    const existing = await collection.findOne(key);
    if (!existing) return req.reject(404, "Dispatch Address not found");

    const updateFields = {
      ...req.data,
      modifiedAt: new Date().toISOString()
    };

    await collection.updateOne(key, { $set: updateFields });
    return { ...key, ...updateFields };

  } catch (err) {
    console.error("Error updating PODispatchAddresses:", err);
    return req.reject(500, "Failed to update Dispatch Address");
  }
});

this.on("DELETE", PODispatchAddresses, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ADDR");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      DispatchNumber: req.data.DispatchNumber,
      InvoiceBillTrack: req.data.InvoiceBillTrack
    };

    const result = await collection.deleteOne(key);
    if (!result.deletedCount) {
      return req.reject(404, "Dispatch Address not found");
    }

    return { message: "Dispatch Address deleted successfully" };

  } catch (err) {
    console.error("Error deleting PODispatchAddresses:", err);
    return req.reject(500, "Failed to delete Dispatch Address");
  }
});


/*PODispatchItems*/

this.on("CREATE", PODispatchItems, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ITEMS");

    const payload = {
      ...req.data,
      RemainingQuantity:
        (req.data.OrderedQuantity || 0) -
        (req.data.CurrentDispatchQuantity || 0),
      createdAt: new Date().toISOString()
    };

    await collection.insertOne(payload);
    return payload;

  } catch (err) {
    console.error("Error creating Dispatch Item:", err);
    return req.reject(500, "Failed to create Dispatch Item");
  }
});

this.on("READ", PODispatchItems, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ITEMS");

    const filters = req.query?.SELECT?.where || [];
    const query = await buildMongoFilter(filters, req);

    const data = await collection.find(query).toArray();
    data["$count"] = data.length;

    return data;
  } catch (err) {
    console.error("Error reading PODispatchItems:", err);
    return req.reject(500, "Failed to read Dispatch Items");
  }
});

this.on("UPDATE", PODispatchItems, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ITEMS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      DispatchNumber: req.data.DispatchNumber,
      ItemNumber: req.data.ItemNumber
    };

    const existing = await collection.findOne(key);
    if (!existing) return req.reject(404, "Dispatch Item not found");

    const updateFields = {
      ...req.data,
      RemainingQuantity:
        (req.data.OrderedQuantity ?? existing.OrderedQuantity ?? 0) -
        (req.data.CurrentDispatchQuantity ?? existing.CurrentDispatchQuantity ?? 0),
      modifiedAt: new Date().toISOString()
    };

    await collection.updateOne(key, { $set: updateFields });
    return { ...key, ...updateFields };

  } catch (err) {
    console.error("Error updating PODispatchItems:", err);
    return req.reject(500, "Failed to update Dispatch Item");
  }
});
this.on("DELETE", PODispatchItems, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ITEMS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      DispatchNumber: req.data.DispatchNumber,
      ItemNumber: req.data.ItemNumber
    };

    const result = await collection.deleteOne(key);
    if (!result.deletedCount) {
      return req.reject(404, "Dispatch Item not found");
    }

    return { message: "Dispatch Item deleted successfully" };

  } catch (err) {
    console.error("Error deleting PODispatchItems:", err);
    return req.reject(500, "Failed to delete Dispatch Item");
  }
});


    // virtual rem quantity calculation
    this.after('READ', 'PODispatchItems', async (data, req) => {
        // Handle both single object and array of objects
        const items = Array.isArray(data) ? data : [data];

        await Promise.all(items.map(async (item) => {
            if (!item.PONumber || !item.ItemNumber) return;

            //Get the original total ordered quantity from POItem
            const poItem = await SELECT.one.from(POItems).where({
                PONumber: item.PONumber,
                PlantCode: item.PlantCode,
                ItemNumber: item.ItemNumber
            });

            if (!poItem) {
                item.RemainingQuantity = 0;
                return;
            }

            // 2. Sum up ALL "CurrentDispatchQuantity" already recorded for this specific Item
            // Note: We exclude the current dispatch record if we only want to see what was left BEFORE this entry
            const totalDispatchedResult = await SELECT.one`sum(CurrentDispatchQuantity) as sum`
                .from(PODispatchItems)
                .where({
                    PONumber: item.PONumber,
                    PlantCode: item.PlantCode,
                    ItemNumber: item.ItemNumber
                });

            const totalDispatched = totalDispatchedResult.sum || 0;

            // Remaining = Original PO Qty - All Dispatches
            item.RemainingQuantity = poItem.OrderedQuantity - totalDispatched;
        }));
    });
});