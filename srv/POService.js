const cds = require("@sap/cds");
const { mongoRead, handleCRUD, parentexists, parentDeleted } = require("./helper/helper");


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



//children must carry same parent keys as VIM_PO_HEADERS
function ensureParentKeysMatch(req, parent, children, keyFields) {
  if (!req.data[children]) return;

  for (const child of req.data[children]) {
    keyFields.forEach(k => {
      if (child[k] !== req.data[k]) {
        req.reject(
          400,
          `${children}: ${k} must match VIM_PO_HEADERS ${k}`
        );
      }
    });
  }
}
//strict deep insert validation //not working properly for now
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

//Cascade delete enforcement at Mongo level
async function cascadeDelete(parentKeys, childCollections, parentCollection) {
  for (const col of childCollections) {
    await db.collection(col).deleteMany(parentKeys);
  }
  await db.collection(parentCollection).deleteOne(parentKeys);
}


module.exports = cds.service.impl(async function () {

  const {
    VIM_PO_HEADERS,
    VIM_PO_ITEMS,
    VIM_PO_DISPATCH_ADDR,
    VIM_PO_DISPATCH_ITEMS
  } = this.entities;


  const COLLECTIONS = {
    VIM_PO_HEADERS: "VIM_PO_HEADERS",
    VIM_PO_ITEMS: "VIM_PO_ITEMS",
    VIM_PO_DISPATCH_ADDR: "VIM_PO_DISPATCH_ADDR",
    VIM_PO_DISPATCH_ITEMS: "VIM_PO_DISPATCH_ITEMS"
  };

this.before(["CREATE", "UPDATE"], VIM_PO_HEADERS, async(req) => {
  requireKeys(req, ["PONumber", "PlantCode"], "VIM_PO_HEADERS");


  validateDeepInsertKeys(req); //not working properly
  //Deep-insert, keys match
  // ensureParentKeysMatch(
  //   req,
  //   VIM_PO_HEADERS,
  //   "VIM_PO_ITEMS",
  //   ["PONumber", "PlantCode"]
  // );

  
  // ensureParentKeysMatch(
  //   req,
  //   VIM_PO_HEADERS,
  //   "VIM_PO_DISPATCH_ADDR",
  //   ["PONumber", "PlantCode"]
  // );

  
  // ensureParentKeysMatch(
  //   req,
  //   VIM_PO_HEADERS,
  //   "VIM_PO_DISPATCH_ITEMS",
  //   ["PONumber", "PlantCode"]
  // );
});


  // this.on("READ", VIM_PO_HEADERS, req =>
  //   console.log("req is",req),
  //   mongoRead(COLLECTIONS.VIM_PO_HEADERS, req, [
  //     { name: "VIM_PO_ITEMS" },
  //     { name: "VIM_PO_DISPATCH_ADDR" }
  //   ])
  // );
this.on("READ", VIM_PO_HEADERS, async (req) => {
  console.log("READ POHeaders req:", req);

  // return mongoRead(
  //   COLLECTIONS.VIM_PO_HEADERS,
  //   req
  // );

  // handle $expand option
        const { expand } = req.query;
        let expandedData = {};
        
        // Handle expand for related entities
        if (expand && expand.includes('VIM_PO_ITEMS')) {
            expandedData['VIM_PO_ITEMS'] = await mongoRead("VIM_PO_ITEMS", req.data.PONumber, req.data.PlantCode);
        }
        if (expand && expand.includes('VIM_PO_DISPATCH_ADDR')) {
            expandedData['VIM_PO_DISPATCH_ADDR'] = await mongoRead("VIM_PO_DISPATCH_ADDR", req.data.PONumber, req.data.PlantCode);
        }
        if (expand && expand.includes('VIM_PO_DISPATCH_ITEMS')) {
            expandedData['VIM_PO_DISPATCH_ITEMS'] = await mongoRead("VIM_PO_DISPATCH_ITEMS", req.data.PONumber, req.data.PlantCode);
        }

        // Combine parent data with expanded data
        const parentData = await mongoRead("VIM_PO_HEADERS", req.data.PONumber, req.data.PlantCode);
        return { ...parentData, ...expandedData };
    });
});

  this.on("CREATE", VIM_PO_HEADERS, req =>
    handleCRUD(req, "create", "PONumber", req.data.PONumber, null, COLLECTIONS.VIM_PO_HEADERS)
  );

  this.on("UPDATE", VIM_PO_HEADERS, req =>
    handleCRUD(req, "update", "PONumber", req.data.PONumber, null, COLLECTIONS.VIM_PO_HEADERS)
  );

  this.on("DELETE", VIM_PO_HEADERS, async(req) =>{
    await handleCRUD(req, "delete", null, null, null, COLLECTIONS.VIM_PO_HEADERS)

    //casdade delete
    await cascadeDelete(req, "delete", null, null, null, COLLECTIONS.VIM_PO_ITEMS,COLLECTIONS.VIM_PO_DISPATCH_ADDR,COLLECTIONS.VIM_PO_DISPATCH_ITEMS)


    return { message: "VIM_PO_HEADERS and all child records deleted successfully" };
});

this.before(["CREATE", "UPDATE"], VIM_PO_ITEMS, async(req) => {
  requireKeys(
    req,
    ["PONumber", "PlantCode", "ItemNumber"],
    "VIM_PO_ITEMS"
  );

const header= await parentexists(req, "create", "PONumber", req.data.PONumber, null, COLLECTIONS.VIM_PO_HEADERS)
console.log("header is",header)
  if (!header) {
    req.reject(400, "VIM_PO_ITEMS: Parent VIM_PO_HEADERS does not exist");
    return;
  }

});

  this.on("READ", VIM_PO_ITEMS, req =>
    mongoRead(COLLECTIONS.VIM_PO_ITEMS, req)
  );

  this.on("CREATE", VIM_PO_ITEMS, req =>
    handleCRUD(req, "create", "ItemNumber", req.data.ItemNumber, null, COLLECTIONS.VIM_PO_ITEMS)
  );

  this.on("UPDATE", VIM_PO_ITEMS, req =>
    handleCRUD(req, "update", "ItemNumber", req.data.ItemNumber, null, COLLECTIONS.VIM_PO_ITEMS)
  );

  this.on("DELETE", VIM_PO_ITEMS,async (req) =>{
    const headerExists = await SELECT.one.from(VIM_PO_HEADERS).where({
    PONumber: req.data.PONumber,
    PlantCode: req.data.PlantCode
  });

  if (!headerExists) {
    req.reject(400, "VIM_PO_ITEMS: Parent VIM_PO_HEADERS does not exist");
  }

  // Perform the deletion
    handleCRUD(req, "delete", null, null, null, COLLECTIONS.VIM_PO_ITEMS)
});

this.before(["CREATE", "UPDATE"], VIM_PO_DISPATCH_ADDR, async(req) => {
  requireKeys(
    req,
    ["PONumber", "PlantCode", "DispatchNumber", "InvoiceBillTrack"],
    "VIM_PO_DISPATCH_ADDR"
  );


  const header= await parentexists(req, "create", "PONumber", req.data.PONumber, null, COLLECTIONS.VIM_PO_HEADERS)
  console.log("header is",header)
  if (!header) {
    req.reject(400, "VIM_PO_ITEMS: Parent VIM_PO_HEADERS does not exist");
    return;
  }
});


  this.on("READ", VIM_PO_DISPATCH_ADDR, req =>
    mongoRead(COLLECTIONS.VIM_PO_DISPATCH_ADDR, req)
  );

  this.on("CREATE", VIM_PO_DISPATCH_ADDR, req =>
    handleCRUD(
      req,
      "create",
      "DispatchNumber",
      req.data.DispatchNumber,
      null,
      COLLECTIONS.VIM_PO_DISPATCH_ADDR
    )
  );

  this.on("UPDATE", VIM_PO_DISPATCH_ADDR, req =>
    handleCRUD(
      req,
      "update",
      "DispatchNumber",
      req.data.DispatchNumber,
      null,
      COLLECTIONS.VIM_PO_DISPATCH_ADDR
    )
  );

  this.on("DELETE", VIM_PO_DISPATCH_ADDR, async(req) => {
  const headerExists = await SELECT.one.from(VIM_PO_HEADERS).where({
    PONumber: req.data.PONumber,
    PlantCode: req.data.PlantCode
  });

  if (!headerExists) {
    req.reject(400, "VIM_PO_ITEMS: Parent VIM_PO_HEADERS does not exist");
  }

  // Perform the deletion
    handleCRUD(req, "delete", null, null, null, COLLECTIONS.VIM_PO_DISPATCH_ADDR)
});

this.before(["CREATE", "UPDATE"], VIM_PO_DISPATCH_ITEMS, async(req) => {
  requireKeys(
    req,
    ["PONumber", "PlantCode", "DispatchNumber", "ItemNumber"],
    "VIM_PO_DISPATCH_ITEMS"
  );


  const header= await parentexists(req, "create", "PONumber", req.data.PONumber, null, COLLECTIONS.VIM_PO_HEADERS)
  console.log("header is",header)
  if (!header) {
    req.reject(400, "VIM_PO_ITEMS: Parent VIM_PO_HEADERS does not exist");
    return;
  }
});


  this.on("READ", VIM_PO_DISPATCH_ITEMS, req =>
    mongoRead(COLLECTIONS.VIM_PO_DISPATCH_ITEMS, req)
  );

  this.on("CREATE", VIM_PO_DISPATCH_ITEMS, async (req) => {
    req.data.RemainingQuantity =
      (req.data.OrderedQuantity || 0) -
      (req.data.CurrentDispatchQuantity || 0);

    return handleCRUD(
      req,
      "create",
      "ItemNumber",
      req.data.ItemNumber,
      null,
      COLLECTIONS.VIM_PO_DISPATCH_ITEMS
    );
  });

  this.on("UPDATE", VIM_PO_DISPATCH_ITEMS, async (req) => {
    req.data.RemainingQuantity =
      (req.data.OrderedQuantity || 0) -
      (req.data.CurrentDispatchQuantity || 0);

    return handleCRUD(
      req,
      "update",
      "ItemNumber",
      req.data.ItemNumber,
      null,
      COLLECTIONS.VIM_PO_DISPATCH_ITEMS
    );
  });

  this.on("DELETE", VIM_PO_DISPATCH_ITEMS, async(req) => {
  const headerExists = await SELECT.one.from(VIM_PO_HEADERS).where({
    PONumber: req.data.PONumber,
    PlantCode: req.data.PlantCode
  });

  if (!headerExists) {
    req.reject(400, "VIM_PO_ITEMS: Parent VIM_PO_HEADERS does not exist");
  }

  // Perform the deletion
    handleCRUD(req, "delete", null, null, null, COLLECTIONS.VIM_PO_DISPATCH_ITEMS)
});



  this.after("READ", VIM_PO_DISPATCH_ITEMS, async (data) => {
    const items = Array.isArray(data) ? data : [data];

    await Promise.all(items.map(async (item) => {
      if (!item.PONumber || !item.ItemNumber) return;

      const VIM_PO_ITEMS = await SELECT.one.from(VIM_PO_ITEMS).where({
        PONumber: item.PONumber,
        PlantCode: item.PlantCode,
        ItemNumber: item.ItemNumber
      });

      if (!VIM_PO_ITEMS) {
        item.RemainingQuantity = 0;
        return;
      }

      const dispatched = await SELECT.one`
        sum(CurrentDispatchQuantity) as sum
      `.from(VIM_PO_DISPATCH_ITEMS).where({
        PONumber: item.PONumber,
        PlantCode: item.PlantCode,
        ItemNumber: item.ItemNumber
      });

      item.RemainingQuantity =
        VIM_PO_ITEMS.OrderedQuantity - (dispatched?.sum || 0);
    }));
  });

});
