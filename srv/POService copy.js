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




//strict deep insert validation to check po number and plant code are unique for parent and child //not working properly for now
function validateDeepInsertKeys(req) {
  const parentKeys = ["PONumber", "PlantCode"];
  const children = [
    "VIM_PO_ITEMS",
    "VIM_PO_DISPATCH_ADDR",
    "VIM_PO_DISPATCH_ITEMS"
  ];

  children.forEach(childName => {
    const arr = req.data[childName];
    if (!arr) return; // no child array provided
    arr.forEach((child, idx) => {
      parentKeys.forEach(key => {
        if (!child.hasOwnProperty(key) || child[key] !== req.data[key]) {
          req.error(400, `${childName}[${idx}]: ${key} must match VIM_PO_HEADERS ${key}`);
        }
      });
    });
  });
}
module.exports = cds.service.impl(async function() {
    const { VIM_PO_HEADERS,VIM_PO_DISPATCH_ADDR,VIM_PO_DISPATCH_ITEMS, VIM_PO_ITEMS } = this.entities;
    try {
    const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }

  /*VIM_PO_HEADERS*/

this.on("CREATE", VIM_PO_HEADERS, async (req) => {
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
    console.error("Error creating VIM_PO_HEADER:", err);
    return req.reject(500, "Failed to create VIM_PO_HEADER");
  }
});

  this.on("READ", VIM_PO_HEADERS, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_HEADERS");

    const filters = req.query?.SELECT?.where || [];
    const query = await buildMongoFilter(filters, req);

    const data = await collection.find(query).toArray();
    data["$count"] = data.length;

    return data;
  } catch (err) {
    console.error("Error reading VIM_PO_HEADERS:", err);
    return req.reject(500, "Failed to read VIM_PO_HEADERS");
  }
});

this.on("UPDATE", VIM_PO_HEADERS, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_HEADERS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode
    };

    const existing = await collection.findOne(key);
    if (!existing) return req.reject(404, "VIM_PO_HEADER not found");

    const updateFields = {
      ...req.data,
      modifiedAt: new Date().toISOString()
    };

    await collection.updateOne(key, { $set: updateFields });
    return { ...key, ...updateFields };

  } catch (err) {
    console.error("Error updating VIM_PO_HEADER:", err);
    return req.reject(500, "Failed to update VIM_PO_HEADER");
  }
});

this.on("DELETE", VIM_PO_HEADERS, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_HEADERS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode
    };

    const result = await collection.deleteOne(key);
    if (!result.deletedCount) return req.reject(404, "VIM_PO_HEADER not found");

    return { message: "VIM_PO_HEADER deleted successfully" };

  } catch (err) {
    console.error("Error deleting VIM_PO_HEADER:", err);
    return req.reject(500, "Failed to delete VIM_PO_HEADER");
  }
});

/*VIM_PO_ITEMS*/
this.on("CREATE", VIM_PO_ITEMS, async (req) => {
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
    console.error("Error creating VIM_PO_ITEM:", err);
    return req.reject(500, "Failed to create VIM_PO_ITEM");
  }
});

this.on("READ", VIM_PO_ITEMS, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_ITEMS");

    const filters = req.query?.SELECT?.where || [];
    const query = await buildMongoFilter(filters, req);

    const data = await collection.find(query).toArray();
    data["$count"] = data.length;

    return data;
  } catch (err) {
    console.error("Error reading VIM_PO_ITEMS:", err);
    return req.reject(500, "Failed to read VIM_PO_ITEMS");
  }
});

this.on("UPDATE", VIM_PO_ITEMS, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_ITEMS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      ItemNumber: req.data.ItemNumber
    };

    const existing = await collection.findOne(key);
    if (!existing) return req.reject(404, "VIM_PO_ITEM not found");

    await collection.updateOne(key, {
      $set: { ...req.data, modifiedAt: new Date().toISOString() }
    });

    return { ...key, ...req.data };

  } catch (err) {
    console.error("Error updating VIM_PO_ITEM:", err);
    return req.reject(500, "Failed to update VIM_PO_ITEM");
  }
});

this.on("DELETE", VIM_PO_ITEMS, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_ITEMS");

    const key = {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      ItemNumber: req.data.ItemNumber
    };

    const result = await collection.deleteOne(key);
    if (!result.deletedCount) return req.reject(404, "VIM_PO_ITEM not found");

    return { message: "VIM_PO_ITEM deleted successfully" };

  } catch (err) {
    console.error("Error deleting VIM_PO_ITEM:", err);
    return req.reject(500, "Failed to delete VIM_PO_ITEM");
  }
});

/*VIM_PO_DISPATCH_ADDR*/

this.on("CREATE", VIM_PO_DISPATCH_ADDR, async (req) => {
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

this.on("READ", VIM_PO_DISPATCH_ADDR, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ADDR");

    const filters = req.query?.SELECT?.where || [];
    const query = await buildMongoFilter(filters, req);

    const data = await collection.find(query).toArray();
    data["$count"] = data.length;

    return data;
  } catch (err) {
    console.error("Error reading VIM_PO_DISPATCH_ADDR:", err);
    return req.reject(500, "Failed to read Dispatch Addresses");
  }
});

this.on("UPDATE", VIM_PO_DISPATCH_ADDR, async (req) => {
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
    console.error("Error updating VIM_PO_DISPATCH_ADDR:", err);
    return req.reject(500, "Failed to update Dispatch Address");
  }
});

this.on("DELETE", VIM_PO_DISPATCH_ADDR, async (req) => {
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
    console.error("Error deleting VIM_PO_DISPATCH_ADDR:", err);
    return req.reject(500, "Failed to delete Dispatch Address");
  }
});


/*VIM_PO_DISPATCH_ITEMS*/

this.on("CREATE", VIM_PO_DISPATCH_ITEMS, async (req) => {
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

this.on("READ", VIM_PO_DISPATCH_ITEMS, async (req) => {
  try {
    const { database } = await getConnection();
    const collection = database.collection("AISP_PO_DISPATCH_ITEMS");

    const filters = req.query?.SELECT?.where || [];
    const query = await buildMongoFilter(filters, req);

    const data = await collection.find(query).toArray();
    data["$count"] = data.length;

    return data;
  } catch (err) {
    console.error("Error reading VIM_PO_DISPATCH_ITEMS:", err);
    return req.reject(500, "Failed to read Dispatch Items");
  }
});

this.on("UPDATE", VIM_PO_DISPATCH_ITEMS, async (req) => {
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
    console.error("Error updating VIM_PO_DISPATCH_ITEMS:", err);
    return req.reject(500, "Failed to update Dispatch Item");
  }
});
this.on("DELETE", VIM_PO_DISPATCH_ITEMS, async (req) => {
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
    console.error("Error deleting VIM_PO_DISPATCH_ITEMS:", err);
    return req.reject(500, "Failed to delete Dispatch Item");
  }
});


    // virtual rem quantity calculation
    this.after('READ', 'VIM_PO_DISPATCH_ITEMS', async (data, req) => {
        // Handle both single object and array of objects
        const items = Array.isArray(data) ? data : [data];

        await Promise.all(items.map(async (item) => {
            if (!item.PONumber || !item.ItemNumber) return;

            //Get the original total ordered quantity from VIM_PO_ITEM
            const VIM_PO_ITEM = await SELECT.one.from(VIM_PO_ITEMS).where({
                PONumber: item.PONumber,
                PlantCode: item.PlantCode,
                ItemNumber: item.ItemNumber
            });

            if (!VIM_PO_ITEM) {
                item.RemainingQuantity = 0;
                return;
            }

            // 2. Sum up ALL "CurrentDispatchQuantity" already recorded for this specific Item
            // Note: We exclude the current dispatch record if we only want to see what was left BEFORE this entry
            const totalDispatchedResult = await SELECT.one`sum(CurrentDispatchQuantity) as sum`
                .from(VIM_PO_DISPATCH_ITEMS)
                .where({
                    PONumber: item.PONumber,
                    PlantCode: item.PlantCode,
                    ItemNumber: item.ItemNumber
                });

            const totalDispatched = totalDispatchedResult.sum || 0;

            // Remaining = Original PO Qty - All Dispatches
            item.RemainingQuantity = VIM_PO_ITEM.OrderedQuantity - totalDispatched;
        }));
    });
});