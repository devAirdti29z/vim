const cds = require("@sap/cds");
const { mongoRead, handleCRUD } = require("./helper/helper");


//for keys not null validation
function requireKeys(req, keys, entityName) {
  const missing = keys.filter(
    k => req.data[k] === undefined || req.data[k] === null || req.data[k] === ""
  );

  if (missing.length) {
    req.reject(
      400,
      `${entityName}: Missing mandatory key field(s): ${missing.join(", ")}`
    );
  }
}

//for not allowing duplicate
async function ensureNotExists(req, entity, where, entityName) {
  const exists = await SELECT.one.from(entity).where(where);
  if (exists) {
    req.reject(
      409,
      `${entityName}: Record already exists for key ${JSON.stringify(where)}`
    );
  }
}
//children must carry same parent keys as POHeader
function ensureParentKeysMatch(req, parent, children, keyFields) {
  if (!req.data[children]) return;

  for (const child of req.data[children]) {
    keyFields.forEach(k => {
      if (child[k] !== req.data[k]) {
        req.reject(
          400,
          `${children}: ${k} must match POHeader ${k}`
        );
      }
    });
  }
}
//strict deep insert validation //not working properly for now
function validateDeepInsertKeys(req) {
  const parentKeys = ["PONumber", "PlantCode"];
  const children = [
    "POItems",
    "DispatchAddresses",
    "DispatchItems"
  ];

  children.forEach(childName => {
    const arr = req.data[childName];
    if (!arr) return; // no child array provided
    arr.forEach((child, idx) => {
      parentKeys.forEach(key => {
        if (!child.hasOwnProperty(key) || child[key] !== req.data[key]) {
          req.error(400, `${childName}[${idx}]: ${key} must match POHeader ${key}`);
        }
      });
    });
  });
}



module.exports = cds.service.impl(async function () {

  const {
    POHeaders,
    POItems,
    PODispatchAddresses,
    PODispatchItems
  } = this.entities;


  const COLLECTIONS = {
    POHeaders: "VIM_PO_HEADERS",
    POItems: "VIM_PO_ITEMS",
    PODispatchAddresses: "VIM_PO_DISPATCH_ADDR",
    PODispatchItems: "VIM_PO_DISPATCH_ITEMS"
  };

this.before(["CREATE", "UPDATE"], POHeaders, async(req) => {
  requireKeys(req, ["PONumber", "PlantCode"], "POHeaders");

  //prevent duplication
  await ensureNotExists(
    req,
    POHeaders,
    { PONumber: req.data.PONumber, PlantCode: req.data.PlantCode },
    "POHeaders"
  );

  validateDeepInsertKeys(req); //not working properly
  //Deep-insert, keys match
  // ensureParentKeysMatch(
  //   req,
  //   POHeaders,
  //   "POItems",
  //   ["PONumber", "PlantCode"]
  // );

  
  // ensureParentKeysMatch(
  //   req,
  //   POHeaders,
  //   "DispatchAddresses",
  //   ["PONumber", "PlantCode"]
  // );

  
  // ensureParentKeysMatch(
  //   req,
  //   POHeaders,
  //   "DispatchItems",
  //   ["PONumber", "PlantCode"]
  // );
});


  this.on("READ", POHeaders, req =>
    mongoRead(COLLECTIONS.POHeaders, req, [
      { name: "POItems" },
      { name: "PODispatchAddresses" }
    ])
  );

  this.on("CREATE", POHeaders, req =>
    handleCRUD(req, "create", "PONumber", req.data.PONumber, null, COLLECTIONS.POHeaders)
  );

  this.on("UPDATE", POHeaders, req =>
    handleCRUD(req, "update", "PONumber", req.data.PONumber, null, COLLECTIONS.POHeaders)
  );

  this.on("DELETE", POHeaders, req =>
    handleCRUD(req, "delete", null, null, null, COLLECTIONS.POHeaders)
  );

this.before(["CREATE", "UPDATE"], POItems, async(req) => {
  requireKeys(
    req,
    ["PONumber", "PlantCode", "ItemNumber"],
    "POItems"
  );

  //prevent duplication
  await ensureNotExists(
    req,
    POItems,
    {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      ItemNumber: req.data.ItemNumber
    },
    "POItems"
  );

  //Parent key must exist
  const header = await SELECT.one.from(POHeaders).where({
    PONumber: req.data.PONumber,
    PlantCode: req.data.PlantCode
  });

  if (!header) {
    req.reject(400, "POItems: Parent POHeader does not exist");
  }
});


  this.on("READ", POItems, req =>
    mongoRead(COLLECTIONS.POItems, req)
  );

  this.on("CREATE", POItems, req =>
    handleCRUD(req, "create", "ItemNumber", req.data.ItemNumber, null, COLLECTIONS.POItems)
  );

  this.on("UPDATE", POItems, req =>
    handleCRUD(req, "update", "ItemNumber", req.data.ItemNumber, null, COLLECTIONS.POItems)
  );

  this.on("DELETE", POItems, req =>
    handleCRUD(req, "delete", null, null, null, COLLECTIONS.POItems)
  );

this.before(["CREATE", "UPDATE"], PODispatchAddresses, async(req) => {
  requireKeys(
    req,
    ["PONumber", "PlantCode", "DispatchNumber", "InvoiceBillTrack"],
    "PODispatchAddresses"
  );

  //prevent duplication
  await ensureNotExists(
    req,
    PODispatchAddresses,
    {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      DispatchNumber: req.data.DispatchNumber,
      InvoiceBillTrack: req.data.InvoiceBillTrack
    },
    "PODispatchAddresses"
  );

  const header = await SELECT.one.from(POHeaders).where({
    PONumber: req.data.PONumber,
    PlantCode: req.data.PlantCode
  });

  if (!header) {
    req.reject(400, "PODispatchAddresses: Parent POHeader does not exist");
  }
});


  this.on("READ", PODispatchAddresses, req =>
    mongoRead(COLLECTIONS.PODispatchAddresses, req)
  );

  this.on("CREATE", PODispatchAddresses, req =>
    handleCRUD(
      req,
      "create",
      "DispatchNumber",
      req.data.DispatchNumber,
      null,
      COLLECTIONS.PODispatchAddresses
    )
  );

  this.on("UPDATE", PODispatchAddresses, req =>
    handleCRUD(
      req,
      "update",
      "DispatchNumber",
      req.data.DispatchNumber,
      null,
      COLLECTIONS.PODispatchAddresses
    )
  );

  this.on("DELETE", PODispatchAddresses, req =>
    handleCRUD(req, "delete", null, null, null, COLLECTIONS.PODispatchAddresses)
  );

this.before(["CREATE", "UPDATE"], PODispatchItems, async(req) => {
  requireKeys(
    req,
    ["PONumber", "PlantCode", "DispatchNumber", "ItemNumber"],
    "PODispatchItems"
  );

  //prevent duplication
  await ensureNotExists(
    req,
    PODispatchItems,
    {
      PONumber: req.data.PONumber,
      PlantCode: req.data.PlantCode,
      DispatchNumber: req.data.DispatchNumber,
      ItemNumber: req.data.ItemNumber
    },
    "PODispatchItems"
  );

  const header = await SELECT.one.from(POHeaders).where({
    PONumber: req.data.PONumber,
    PlantCode: req.data.PlantCode
  });

  if (!header) {
    req.reject(400, "PODispatchItems: Parent POHeader does not exist");
  }
});


  this.on("READ", PODispatchItems, req =>
    mongoRead(COLLECTIONS.PODispatchItems, req)
  );

  this.on("CREATE", PODispatchItems, async (req) => {
    req.data.RemainingQuantity =
      (req.data.OrderedQuantity || 0) -
      (req.data.CurrentDispatchQuantity || 0);

    return handleCRUD(
      req,
      "create",
      "ItemNumber",
      req.data.ItemNumber,
      null,
      COLLECTIONS.PODispatchItems
    );
  });

  this.on("UPDATE", PODispatchItems, async (req) => {
    req.data.RemainingQuantity =
      (req.data.OrderedQuantity || 0) -
      (req.data.CurrentDispatchQuantity || 0);

    return handleCRUD(
      req,
      "update",
      "ItemNumber",
      req.data.ItemNumber,
      null,
      COLLECTIONS.PODispatchItems
    );
  });

  this.on("DELETE", PODispatchItems, req =>
    handleCRUD(req, "delete", null, null, null, COLLECTIONS.PODispatchItems)
  );



  this.after("READ", PODispatchItems, async (data) => {
    const items = Array.isArray(data) ? data : [data];

    await Promise.all(items.map(async (item) => {
      if (!item.PONumber || !item.ItemNumber) return;

      const poItem = await SELECT.one.from(POItems).where({
        PONumber: item.PONumber,
        PlantCode: item.PlantCode,
        ItemNumber: item.ItemNumber
      });

      if (!poItem) {
        item.RemainingQuantity = 0;
        return;
      }

      const dispatched = await SELECT.one`
        sum(CurrentDispatchQuantity) as sum
      `.from(PODispatchItems).where({
        PONumber: item.PONumber,
        PlantCode: item.PlantCode,
        ItemNumber: item.ItemNumber
      });

      item.RemainingQuantity =
        poItem.OrderedQuantity - (dispatched?.sum || 0);
    }));
  });

});
