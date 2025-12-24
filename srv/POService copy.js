db.VIM_PO_ITEMS.aggregate([

  // 1️⃣ Match PO

  {

    $match: { PONumber: "PO123457" }

  },
 
  // 2️⃣ Lookup dispatch items

  {

    $lookup: {

      from: "VIM_PO_DISPATCH_ITEMS",

      let: {

        poNumber: "$PONumber",

        itemNumber: "$ItemNumber"

      },

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

            dispatchedQty: { $sum: "$CurrentDispatchQuantity" }

          }

        }

      ],

      as: "dispatchSummary"

    }

  },
 
  // 3️⃣ Extract dispatched quantity (default 0)

  {

    $addFields: {

      dispatchedQty: {

        $ifNull: [

          { $arrayElemAt: ["$dispatchSummary.dispatchedQty", 0] },

          0

        ]

      }

    }

  },
 
  // 4️⃣ Calculate remaining quantity

  {

    $addFields: {

      remainingQty: {

        $subtract: ["$OrderedQuantity", "$dispatchedQty"]

      }

    }

  },
 
  // 5️⃣ Final output

  {

    $project: {

      _id: 0,

      PONumber: 1,

      ItemNumber: 1,

      OrderedQuantity: 1,

      dispatchedQty: 1,

      remainingQty: 1

    }

  }

]);


 