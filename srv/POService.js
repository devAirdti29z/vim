const cds = require("@sap/cds");
const { mongoRead, handleCRUD, parentexists, cascadeDelete,requireKeys, calculateRemainingQuantity,handleExpands } = require("./helper/helper");
const {getConnection}=require("./helper/DBConn")
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


});


// this.on("READ", VIM_PO_HEADERS, async (req) => {
//   console.log("READ POHeaders req:", req);

//   const { expand } = req.query;
//   let expandedData = {};

//   const parentData = await mongoRead(COLLECTIONS.VIM_PO_HEADERS, req);

//   if (expand) {
//     if (expand.includes('VIM_PO_ITEMS')) {
//       expandedData['VIM_PO_ITEMS'] = await mongoRead(
//         COLLECTIONS.VIM_PO_ITEMS,
//         { PONumber: req.data.PONumber, PlantCode: req.data.PlantCode }
//       );
//     }

//     if (expand.includes('VIM_PO_DISPATCH_ADDR')) {
//       expandedData['VIM_PO_DISPATCH_ADDR'] = await mongoRead(
//         COLLECTIONS.VIM_PO_DISPATCH_ADDR,
//         { PONumber: req.data.PONumber, PlantCode: req.data.PlantCode }
//       );
//     }

//     if (expand.includes('VIM_PO_DISPATCH_ITEMS')) {
//       expandedData['VIM_PO_DISPATCH_ITEMS'] = await mongoRead(
//         COLLECTIONS.VIM_PO_DISPATCH_ITEMS,
//         { PONumber: req.data.PONumber, PlantCode: req.data.PlantCode }
//       );
//     }
//   }

//   return parentData;
// });

this.on("READ", VIM_PO_HEADERS, async (req) => {
    console.log("READ POHeaders req:", req);

    // // 1. Define the relationship mapping
    // const expandConfig = {
    //     'VIM_PO_ITEMS': { 
    //         collection: COLLECTIONS.VIM_PO_ITEMS, 
    //         joinKeys: ['PONumber', 'PlantCode'] 
    //     },
    //     'VIM_PO_DISPATCH_ADDR': { 
    //         collection: COLLECTIONS.VIM_PO_DISPATCH_ADDR, 
    //         joinKeys: ['PONumber', 'PlantCode'] 
    //     },
    //     'VIM_PO_DISPATCH_ITEMS': { 
    //         collection: COLLECTIONS.VIM_PO_DISPATCH_ITEMS, 
    //         joinKeys: ['PONumber', 'PlantCode'] 
    //     }
    // };

    
    const parentData = await mongoRead(COLLECTIONS.VIM_PO_HEADERS, req);


   // const expandedData = await handleExpands(req, expandConfig);

    return parentData
    //return { ...parentData, ...expandedData };
});

  this.on("CREATE", VIM_PO_HEADERS, req =>
    handleCRUD(req, "create", "PONumber", req.data.PONumber, null, COLLECTIONS.VIM_PO_HEADERS)
  );

  this.on("UPDATE", VIM_PO_HEADERS, req =>
    handleCRUD(req, "update", "PONumber", req.data.PONumber, null, COLLECTIONS.VIM_PO_HEADERS)
  );

  this.on("DELETE", VIM_PO_HEADERS, async(req) =>{
    await handleCRUD(req, "delete", null, null, null, COLLECTIONS.VIM_PO_HEADERS)

    //cascade delete
    await cascadeDelete(req, "delete", null, null, null, [COLLECTIONS.VIM_PO_ITEMS,COLLECTIONS.VIM_PO_DISPATCH_ADDR,COLLECTIONS.VIM_PO_DISPATCH_ITEMS])


    return { message: "VIM_PO_HEADERS and all child records deleted successfully" };
});

this.before(["CREATE", "UPDATE"], VIM_PO_ITEMS, async(req) => {
  requireKeys(
    req,
    ["PONumber", "PlantCode", "ItemNumber"],
    "VIM_PO_ITEMS"
  );
console.log(req.data.PONumber)
console.log(req.data.PlantCode)
const header= await parentexists(req, "create", "PONumber",req.data.PONumber, null, COLLECTIONS.VIM_PO_HEADERS)
console.log("header is----------------------------------------------------------",header)
  if (!header) {
    req.reject(400, "VIM_PO_ITEMS: Parent VIM_PO_HEADERS does not exist");
    return;
  }

});



this.on("READ", VIM_PO_ITEMS, async (req) => {
  try {

    console.log("Fetching records for VIM_PO_ITEMS with filters:", req.query.SELECT.where);
    const result = await mongoRead("VIM_PO_ITEMS", req);
    console.log("Fetched VIM_PO_ITEMS records:", result);


    for (let item of result) {
      const { PONumber, PlantCode, ItemNumber } = item;
      console.log(`Processing item: PONumber: ${PONumber}, PlantCode: ${PlantCode}, ItemNumber: ${ItemNumber}`);


      const aggregationPipeline = [
        {
          $match: { PONumber, ItemNumber },
        },
        {
          $lookup: {
            from: "VIM_PO_DISPATCH_ITEMS",
            let: { poNumber: "$PONumber", itemNumber: "$ItemNumber" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$PONumber", "$$poNumber"] },
                      { $eq: ["$ItemNumber", "$$itemNumber"] }
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  dispatchedQty: { $sum: "$CurrentDispatchQuantity" },
                  remainingQty: { $sum: "$RemainingQuantity" }
                }
              }
            ],
            as: "dispatchSummary"
          }
        },
        {
          $addFields: {
            dispatchedQty: {
              $ifNull: [{ $arrayElemAt: ["$dispatchSummary.dispatchedQty", 0] }, 0]
            },
            remainingQty: {
              $ifNull: [{ $arrayElemAt: ["$dispatchSummary.remainingQty", 0] }, 0]
            }
          }
        },
        {
          $addFields: {
            calculatedRemainingQuantity: {
              $subtract: ["$remainingQty", "$dispatchedQty"]
            }
          }
        },
        {
          $project: {
            _id: 0,
            PONumber: 1,
            ItemNumber: 1,
            Material: 1,
            OrderedQuantity: 1,
            dispatchedQty: 1,
            remainingQty: 1,
            calculatedRemainingQuantity: 1
          }
        }
      ];

      console.log("Aggregation pipeline:", JSON.stringify(aggregationPipeline, null, 2));
      const { database } = await getConnection();
   
      const aggregatedData=await database.collection('VIM_PO_ITEMS')
               .aggregate(aggregationPipeline)
               .toArray();
  
      console.log("dispatched summary:",aggregatedData.dispatchedQty)
      console.log("Aggregated data on for PONumber:", PONumber, "ItemNumber:", ItemNumber, ":", aggregatedData);

      if (aggregatedData && aggregatedData.length > 0) {
        const aggregatedItem = aggregatedData[0];
        console.log("Aggregated item:", aggregatedItem);

        item.RemainingQuantity = aggregatedItem.calculatedRemainingQuantity;
        console.log("Updated RemainingQuantity for item:", PONumber, "-", ItemNumber, ":", item.RemainingQuantity);
      } else {

        item.RemainingQuantity = item.OrderedQuantity;
        console.log("No dispatch data found. Using OrderedQuantity for RemainingQuantity:", item.RemainingQuantity);
      }
    }


    console.log("Returning updated VIM_PO_ITEMS:", result);
    return result;

  } catch (error) {
    console.error("Error calculating RemainingQuantity:", error);
    req.reject(500, "Error calculating RemainingQuantity");
  }
});

// this.on("READ",VIM_PO_ITEMS,async(req)=>{

//   const PONumber="PO123457";
//   const ItemNumber=110;

//   if(PONumber && ItemNumber){
//       const aggregationPipeline = [
//         {
//           $match: { PONumber, ItemNumber },
//         },
//         {
//           $lookup: {
//             from: "VIM_PO_DISPATCH_ITEMS",
//             let: { poNumber: "$PONumber", itemNumber: "$ItemNumber" },
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $and: [
//                       { $eq: ["$PONumber", "$$poNumber"] },
//                       { $eq: ["$ItemNumber", "$$itemNumber"] }
//                     ]
//                   }
//                 }
//               },
//               {
//                 $group: {
//                   _id: null,
//                   dispatchedQty: { $sum: "$CurrentDispatchQuantity" },
//                   remainingQty: { $sum: "$RemainingQuantity" }
//                 }
//               }
//             ],
//             as: "dispatchSummary"
//           }
//         },
//         {
//           $addFields: {
//             dispatchedQty: {
//               $ifNull: [{ $arrayElemAt: ["$dispatchSummary.dispatchedQty", 0] }, 0]
//             },
//             remainingQty: {
//               $ifNull: [{ $arrayElemAt: ["$dispatchSummary.remainingQty", 0] }, 0]
//             }
//           }
//         },
//         {
//           $addFields: {
//             calculatedRemainingQuantity: {
//               $subtract: ["$remainingQty", "$dispatchedQty"]
//             }
//           }
//         },
//         {
//           $project: {
//             _id: 0,
//             PONumber: 1,
//             ItemNumber: 1,
//             Material: 1,
//             OrderedQuantity: 1,
//             dispatchedQty: 1,
//             remainingQty: 1,
//             calculatedRemainingQuantity: 1
//           }
//         }
//       ];
//       const { database } = await getConnection();
//         //const record =await database.collection('VIM_PO_ITEMS').aggregate(aggregationPipeline);
// const record=await database.collection('VIM_PO_ITEMS')
//                .aggregate(aggregationPipeline)
//                .toArray();
//       //const record= await database.collection('VIM_PO_ITEMS').aggregate(aggregationPipeline)
//       //const record= await mongoRead("VIM_PO_ITEMS", req, aggregationPipeline);
//       return record;
//     }else{
//       mongoRead("VIM_PO_ITEMS",req)
//     }
// }

// )


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
  if (req.data.CurrentDispatchQuantity > req.data.RemainingQuantity){
    req.reject(400, "Current Dispatch Quantity can not be greater than Remaining Quantity");
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
      "InvoiceBillTrack",
      req.data.InvoiceBillTrack,
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


this.on("CREATE", VIM_PO_DISPATCH_ITEMS, async (req) => {
  // Calculate RemainingQuantity when creating a new dispatch entry
  req.data.RemainingQuantity = req.data.OrderedQuantity - req.data.CurrentDispatchQuantity;

  // Proceed with creating the new entry
  return handleCRUD(req, "create", "DispatchNumber", req.data.DispatchNumber, null, COLLECTIONS.VIM_PO_DISPATCH_ITEMS);
});

this.on("UPDATE", VIM_PO_DISPATCH_ITEMS, async (req) => {
  // When updating, calculate RemainingQuantity again based on the updated CurrentDispatchQuantity
  req.data.RemainingQuantity = req.data.OrderedQuantity - req.data.CurrentDispatchQuantity;

  // Proceed with the update operation
  return handleCRUD(req, "update", "ItemNumber", req.data.ItemNumber, null, COLLECTIONS.VIM_PO_DISPATCH_ITEMS);
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


 this.on("READ", VIM_PO_DISPATCH_ITEMS, req =>
    mongoRead(COLLECTIONS.VIM_PO_DISPATCH_ITEMS, req)
  );
});
