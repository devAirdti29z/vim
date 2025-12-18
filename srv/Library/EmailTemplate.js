//FOR VIM PO BASED
//Function to send mail to APPROVERS
function ApproverMailBody(User, Ebeln, Vbeln, TotalAmount) {
  return `<p>Dear ${User},</p>
 
<p>This email serves as a formal notification that a Vendor Invoice Management (VIM) request requires your approval.</p>
 
<p><strong>Details for your review:</strong></p>
<ul>
<li><strong>Purchase Order Number (PO):</strong> ${Ebeln} </li>
<li><strong>Inbound Delivery Number (DL):</strong> ${Vbeln}</li>
<li><strong>Invoice Amount:</strong> ${TotalAmount}</li>
</ul>
 
<p>Please review the request and approve it at your earliest convenience. If you need additional information, kindly let us know. You can access the request through the VIM Portal.</p>
 
<p>We appreciate your timely attention to this matter.</p>
 
<p>Best regards,<br>Airdit Software</p>
`
}

//Function to send rejected mail to vendor
function RejectedInvoiceMail(Ebeln, Vbeln, TotalAmount) {
  return `<p>Dear Vendor</p>
 
<p>We regret to inform you that your Vendor Invoice Management (VIM) request for Purchase Order <strong>${Ebeln}</strong>has been rejected.</p>
 
<p><strong>Details of the request:</strong></p>
<ul>
<li><strong>Purchase Order (PO):</strong> ${Ebeln}</li>
<li><strong>Inbound Delivery (DL):</strong> ${Vbeln}</li>
<li><strong>Invoice Amount:</strong> ${TotalAmount}</li>
<li><strong>${'Rejected'}</strong> Rejected</li>
</ul>
 
<p>If you have any questions or need further clarification regarding the rejection, please contact the approver or the relevant department.</p>
 
<p>Thank you for your understanding and cooperation.</p>
 
<p>Sincerely,<br>Airdit Software</p>
`
}

//FOR VIM NON-PO BASED
function ApproverMailBodyforNPOBasedInvoice(User, INVOICE_NUMBER, INVOICE_DATE, TOTAL_AMOUNT) {
  return `<p>Dear ${User},</p>
 
<p>This email serves as a formal notification that a Vendor Invoice Management (VIM-Non-PoBased)  request requires your approval.</p>
 
<p><strong>Details for your review:</strong></p>
<ul>
<li><strong>Invoice Number :</strong> ${INVOICE_NUMBER} </li>
<li><strong>Invoice Date:</strong> ${INVOICE_DATE}</li>
<li><strong>Invoice Amount:</strong> ${TOTAL_AMOUNT}</li>
</ul>
 
<p>Please review the request and approve it at your earliest convenience. If you need additional information, kindly let us know. You can access the request through the VIM Portal.</p>
 
<p>We appreciate your timely attention to this matter.</p>
 
<p>Best regards,<br>Airdit Software</p>
`
}

function ApproverMailBodyforPOBasedInvoiceWithOCR(User, INVOICE_NUMBER, INVOICE_DATE, INVOICE_AMOUNT) {
  return `<p>Dear ${User},</p>
   
  <p>This email serves as a formal notification that a Vendor Invoice Management (VIM-PoBased)  request requires your approval.</p>
   
  <p><strong>Details for your review:</strong></p>
  <ul>
  <li><strong>Invoice Number :</strong> ${INVOICE_NUMBER} </li>
  <li><strong>Invoice Date:</strong> ${INVOICE_DATE}</li>
  <li><strong>Invoice Amount:</strong> ${INVOICE_AMOUNT}</li>
  </ul>
   
  <p>Please review the request and approve it at your earliest convenience. If you need additional information, kindly let us know. You can access the request through the VIM Portal.</p>
   
  <p>We appreciate your timely attention to this matter.</p>
   
  <p>Best regards,<br>Airdit Software</p>
  `}

function RejectedInvoiceNonPoBasedMail(REQUEST_NO, INVOICE_NUMBER, TOTAL_AMOUNT) {
  return `<p>Dear CODER</p>
 
<p>We regret to inform you that your Vendor Invoice Management (VIM) request for Request Number <strong>${REQUEST_NO}</strong>has been rejected.</p>
 
<p><strong>Details of the request:</strong></p>
<ul>
<li><strong>Invoice Number:</strong> ${INVOICE_NUMBER}</li>
<li><strong>Total Amount</strong> ${TOTAL_AMOUNT}</li>
</ul>
 
<p>If you have any questions or need further clarification regarding the rejection, please contact the approver or the relevant department.</p>
 
<p>Thank you for your understanding and cooperation.</p>
 
<p>Sincerely,<br>Airdit Software</p>
`
}

function RejectedInvoicePoBasedMailWithOCR(REQUEST_NO, INVOICE_NUMBER, TOTAL_AMOUNT) {
  return `<p>Dear CODER</p>
   
  <p>We regret to inform you that your Vendor Invoice Management (VIM) request for Request Number <strong>${REQUEST_NO}</strong>has been rejected.</p>
   
  <p><strong>Details of the request:</strong></p>
  <ul>
  <li><strong>Invoice Number:</strong> ${INVOICE_NUMBER}</li>
  <li><strong>Total Amount</strong> ${TOTAL_AMOUNT}</li>
  </ul>
   
  <p>If you have any questions or need further clarification regarding the rejection, please contact the approver or the relevant department.</p>
   
  <p>Thank you for your understanding and cooperation.</p>
   
  <p>Sincerely,<br>Airdit Software</p>
  `
}

// FOR SES CREATION (SERVICE ENTRY SHEET)
function ApproverMailBodyForSES(User, Ebeln, SESNumber, SESDate, TotalAmount) {
  return `<p>Dear ${User},</p>
 
<p>This email serves as a formal notification that a Service Entry Sheet (SES) request requires your approval.</p>
 
<p><strong>Details for your review:</strong></p>
<ul>
<li><strong>Purchase Order Number (PO):</strong> ${Ebeln}</li>
<li><strong>Service Entry Sheet Number (SES):</strong> ${SESNumber}</li>
<li><strong>SES Date:</strong> ${SESDate}</li>
<li><strong>Total Amount:</strong> ${TotalAmount}</li>
</ul>
 
<p>Please review the SES request and approve it at your earliest convenience. If you need additional information, kindly let us know. You can access the SES request through the SES Portal.</p>
 
<p>We appreciate your timely attention to this matter.</p>
 
<p>Best regards,<br>Airdit Software</p>`;
}

function RejectedSESMail(Ebeln, SESNumber, SESDate, TotalAmount) {
  return `<p>Dear Vendor,</p>
 
<p>We regret to inform you that your Service Entry Sheet (SES) request for Purchase Order <strong>${Ebeln}</strong> and SES Number <strong>${SESNumber}</strong> has been rejected.</p>
 
<p><strong>Details of the request:</strong></p>
<ul>
<li><strong>Purchase Order (PO):</strong> ${Ebeln}</li>
<li><strong>Service Entry Sheet (SES):</strong> ${SESNumber}</li>
<li><strong>SES Date:</strong> ${SESDate}</li>
<li><strong>Total Amount:</strong> ${TotalAmount}</li>
<li><strong>Status:</strong> Rejected</li>
</ul>
 
<p>If you have any questions or need further clarification regarding the rejection, please contact the approver or the relevant department.</p>
 
<p>Thank you for your understanding and cooperation.</p>
 
<p>Sincerely,<br>Airdit Software</p>`;
}

function ExpressionOfInterestMail(recipientName = 'Mr. Arora', eoiLink = 'https://aisp-supplierportal.com/eoi/fiber-cables') {
  return `
<p>Dear ${recipientName},</p>
<p>Greetings from Airdit Infrastructure Solutions Pvt. Ltd.</p>
 
<p>We are currently exploring qualified and reliable partners for our ongoing and upcoming infrastructure projects. We would like to invite you to express interest in collaborating with us.</p>
 
<p>To initiate the empanelment process, please review the preliminary details and confirm your interest using the link below:</p>
<p><a href="${eoiLink}">${eoiLink}</a></p>
 
<p>Once we receive your confirmation, our procurement team will share the formal Supplier Empanelment Request along with the required documentation process.</p>
<p>We look forward to your positive response and a long-term association.</p>
 
<p>Warm regards,</p>
 
<p><strong>Rahul Mehta</strong></p>
<p>Procurement Manager<br>
Airdit Infrastructure Solutions Pvt. Ltd.<br>
rahul.mehta@airditinfra.com | +91-98123-45678</p>
`;
}

module.exports = {
  ApproverMailBody,
  RejectedInvoiceMail,
  ApproverMailBodyforNPOBasedInvoice,
  RejectedInvoiceNonPoBasedMail,
  ApproverMailBodyForSES,
  RejectedSESMail,
  ApproverMailBodyforPOBasedInvoiceWithOCR,
  RejectedInvoicePoBasedMailWithOCR,
  ExpressionOfInterestMail
}