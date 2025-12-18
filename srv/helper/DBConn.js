const { MongoClient } = require("mongodb");

let client;

module.exports = {
  getConnection: async function () {
    const mongoDBConnectionURI =
      "mongodb+srv://Vaibhav:D7tY3V0VTWi5Am0w@aisp.smrk0zv.mongodb.net/";

    if (!client) {
      client = new MongoClient(mongoDBConnectionURI, {
        maxPoolSize: 200,
      });

      try {
        await client.connect();
        console.log("✅ MongoDB connected");
      } catch (err) {
        console.error("❌ MongoDB connection failed:", err);
        throw err;
      }
    }

    const database = client.db("VendorPortal-Airdit");
    return { database };
  },
};
