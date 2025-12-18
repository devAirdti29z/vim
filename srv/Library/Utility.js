// srv/utility.js
const cds = require('@sap/cds');
const DBConn = require('./DBConn');

module.exports = {
    GetNextNumber: async function(type) {
        const { database } = await DBConn.getConnection();
        const collection = database.collection('NumberRangeMASTER');

        try {
            const numberRange = await collection.findOne({ TYPE: type });

            if (!numberRange) {
                throw new Error(`Number range for type ${type} not found`);
            }

            // Check if the NEXT number is within the allowed range
            if (numberRange.NEXT > numberRange.END) {
                throw new Error(`Number range for type ${type} has exceeded its limit`);
            }

            // Increment the CURRENT and NEXT numbers
            const updatedNumberRange = {
                CURRENT: numberRange.NEXT,
                NEXT: numberRange.NEXT + 1,
                
            };

            // Update the record in the database
            await collection.updateOne(
                { TYPE: type },
                { $set: updatedNumberRange }
            );

            // await client.close(); 

            return updatedNumberRange.CURRENT;
        } catch (error) {
            // await client.close(); 
            console.error("Error in GetNextNumber:", error);
            throw error;
        }
    }
};
