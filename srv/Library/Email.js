// const { SYSTEM } = require("@sap/xssec/lib/constants");
const cds = require("@sap/cds");
const nodemailer = require("nodemailer");
const DBConn = require("./DBConn");

module.exports = {
  getEmailConfig: async function () {
    try {
      const { database } = await DBConn.getConnection();
      const collection = database.collection("EMAIL_CONFIGURATION");
      const queryResult = await collection.findOne({ SRNO: 1 });
      return queryResult;
    } catch (err) {
      console.error("Error fetching email configuration:", err);
      throw err;
    }
  },

  sendEmail: async function (
    ToEmails,
    CCEmail,
    type,
    subject,
    body,
    attachments = []
  ) {
    try {
      const lvEmailConfig = await this.getEmailConfig();
      const transporter = nodemailer.createTransport({
        host: lvEmailConfig.HOST,
        port: lvEmailConfig.PORT,
        secure: lvEmailConfig.SECURE,
        auth: {
          user: lvEmailConfig.USERNAME,
          pass: lvEmailConfig.PASSWORD,
        },
      });
      var senderEmail = lvEmailConfig.SENDER_EMAIL;
      // var sToEmails = ToEmails.toString();
      // var sCCEmail = CCEmail.toString();
      // CCEmail = 'zuheb@airditsoftware.com'
      if (type == "html") {
        var mailOptions = {
          from: senderEmail,
          to: ToEmails,
          cc: CCEmail,
          subject: subject,
          html: body,
          attachments: attachments || [],
        };
      } else {
        var mailOptions = {
          from: senderEmail,
          to: ToEmails,
          cc: CCEmail,
          subject: subject,
          text: body,
        };
      }

      var mailres = await transporter.sendMail(mailOptions);

      console.log("Email sent successfully:", mailres);

      var output = {
        records: [],
      };

      var logdata = {
        LOG_ID: "0",
        STATUS: "01",
        STATUS_DSC: "SUCCESS",
        LOG: JSON.stringify(mailres),
        CREATED_ON: "",
        CREATED_DATE: "",
        USER_ID: "userid",
        TO_EMAIL: "0",
        CC_EMAIL: "0",
        SUBJECT: "0",
        BODY: "0",
        TYPE: "0",
      };
      output.records.push(logdata);
      //** enter log in email log table  */

      // Return success status if email is sent
      return { success: true, mailres }; //new
    } catch (error) {
      console.log(error.message, "error msg in emailJS");
      return { success: false, error: error.message }; //new
    }
  },
};
