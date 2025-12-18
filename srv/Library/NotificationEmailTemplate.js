module.exports = {
  // ---------------------------------------------------------
  // 1. BID / RFQ Notifications
  // ---------------------------------------------------------
  BidRFQNotification: (data) => {
    return `
      <h2 style="color:#0057D2;">New Bid / RFQ Update</h2>
      <p>Hello,</p>

      <p>A new <strong>Bid / RFQ notification</strong> has been shared with you.</p>

      <p><strong>Title:</strong> ${data.Title}</p>
      <p><strong>Details:</strong> ${data.Body}</p>
      <p><strong>Priority:</strong> ${data.Priority}</p>

      <p>Please review the update at your earliest convenience.</p>

      <hr/>
      <p style="font-size:12px;color:#666;">This is an automated notification.</p>

      <p>Best regards,<br>Airdit Software</p>
    `;
  },

  // ---------------------------------------------------------
  // 2. BUSINESS ANNOUNCEMENTS
  // ---------------------------------------------------------
  BusinessAnnouncement: (data) => {
    return `
      <h2 style="color:#2A7F62;">Business Announcement</h2>
      <p>Hello,</p>

      <p>Please note the following <strong>official company announcement</strong>:</p>

      <p><strong>${data.Title}</strong></p>
      <p>${data.Body}</p>

      <p>Valid From: <strong>${data.ValidFrom}</strong></p>
      <p>Valid To: <strong>${data.ValidTo}</strong></p>

      <hr/>
      <p style="font-size:12px;color:#666;">Stay informed. Stay updated.</p>

      <p>Best regards,<br>Airdit Software</p>
    `;
  },

  // ---------------------------------------------------------
  // 3. WISHES (FESTIVALS / MILESTONES / BIRTHDAYS)
  // ---------------------------------------------------------
  Wishes: (data) => {
    return `
      <h2 style="color:#D97706;">Warm Wishes</h2>
      <p>Hello,</p>

      <p>${data.Body}</p>

      <p><strong>${data.Title}</strong></p>

      <hr/>
      <p style="font-size:12px;color:#666;">Best Regards,</p>

      <p>Best regards,<br>Airdit Software</p>
    `;
  },

  // ---------------------------------------------------------
  // 4. COMPLIANCE NOTIFICATIONS
  // ---------------------------------------------------------
  ComplianceNotification: (data) => {
    return `
      <h2 style="color:#B91C1C;">Compliance Update</h2>

      <p>Hello,</p>

      <p>This is an important update regarding <strong>compliance requirements</strong>.</p>

      <p><strong>${data.Title}</strong></p>
      <p>${data.Body}</p>

      <p>Please ensure appropriate follow-up actions are taken.</p>

      <hr/>
      <p style="font-size:12px;color:#666;">This compliance notification is auto-generated.</p>

      <p>Best regards,<br>Airdit Software</p>
    `;
  },

  // ---------------------------------------------------------
  // 5. ALERTS (DOWNTIME / MAINTENANCE / URGENT)
  // ---------------------------------------------------------
  AlertNotification: (data) => {
    return `
      <h2 style="color:#DC2626;">⚠ Urgent System Alert</h2>
      <p>Hello,</p>

      <p>Please be informed of the following <strong>urgent alert</strong>:</p>

      <p><strong>${data.Title}</strong></p>
      <p>${data.Body}</p>

      <p><strong>Effective Immediately</strong></p>

      <hr/>
      <p style="font-size:12px;color:#666;">This is a high-priority automated alert.</p>

      <p>Best regards,<br>Airdit Software</p>
    `;
  },
};
