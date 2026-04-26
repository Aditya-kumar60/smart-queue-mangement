// ─── SEND EMAIL VIA BREVO HTTP API ───────────────────────
const sendEmail = async (to, subject, html) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.log(`⚠️ Brevo API Key missing, skipping email to ${to}`);
      return;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'SmartQueue System', email: process.env.EMAIL_USER || 'no-reply@smartqueue.com' },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ Email failed to ${to}:`, errorData);
    } else {
      console.log(`✅ Email sent to ${to} — ${subject}`);
    }
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
  }
};

// ─── 1. REGISTRATION WELCOME EMAIL ─────────────────────
const sendRegistrationEmail = (name, email, role) => {
  const roleMessages = {
    patient: 'You can now book appointments, track your queue position in real-time, and access your medical history.',
    doctor: 'You can now manage your patient queue, view appointments, and complete consultations through your dashboard.',
    staff: 'You can now manage walk-in patients, view all appointments, and monitor queue statistics from your dashboard.'
  };

  const roleEmoji = {
    patient: '🏥',
    doctor: '🩺',
    staff: '📋'
  };

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
          ${roleEmoji[role]} Welcome to SmartQueue!
        </h1>
        <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0; font-size: 16px;">
          Your account has been created successfully
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 35px 30px;">
        <p style="font-size: 17px; color: #333; margin: 0 0 15px;">
          Hello <strong>${name}</strong>,
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.7; margin: 0 0 20px;">
          You have been registered as a <strong style="color: #667eea; text-transform: capitalize;">${role}</strong> on the SmartQueue Management System.
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.7; margin: 0 0 25px;">
          ${roleMessages[role]}
        </p>

        <!-- Info Card -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
          <h3 style="margin: 0 0 12px; color: #333; font-size: 15px;">📧 Your Account Details</h3>
          <table style="width: 100%; font-size: 14px; color: #555;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Name:</td>
              <td style="padding: 6px 0;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Email:</td>
              <td style="padding: 6px 0;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600;">Role:</td>
              <td style="padding: 6px 0; text-transform: capitalize;">${role}</td>
            </tr>
          </table>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5000/login.html" style="background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
            Login to Dashboard →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f1f3f5; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 13px; color: #888;">
          SmartQueue Management System • Automated Queue & Appointment System
        </p>
      </div>
    </div>
  `;

  // Fire and forget — don't await
  sendEmail(email, `Welcome to SmartQueue — Registration Successful! ${roleEmoji[role]}`, html);
};

// ─── 2. APPOINTMENT BOOKED — NOTIFY DOCTOR ──────────────
const sendAppointmentBookedEmail = (doctorEmail, doctorName, patientName, token, symptoms) => {
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
          📋 New Appointment Booked
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
          A patient has booked an appointment with you
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 35px 30px;">
        <p style="font-size: 17px; color: #333; margin: 0 0 20px;">
          Hello <strong>Dr. ${doctorName}</strong>,
        </p>

        <!-- Appointment Card -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 25px; margin-bottom: 25px; border-left: 4px solid #11998e;">
          <h3 style="margin: 0 0 15px; color: #333; font-size: 16px;">🗓 Appointment Details</h3>
          <table style="width: 100%; font-size: 14px; color: #555;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; width: 130px;">Patient Name:</td>
              <td style="padding: 8px 0;">${patientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Token Number:</td>
              <td style="padding: 8px 0;">
                <span style="background: #11998e; color: #fff; padding: 4px 16px; border-radius: 20px; font-weight: 700; font-size: 16px;">
                  #${token}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Symptoms:</td>
              <td style="padding: 8px 0;">${symptoms || 'Not specified'}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #777; line-height: 1.6;">
          Please check your dashboard for the updated queue. The patient is currently in the waiting list.
        </p>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5000/dashboards/doctor.html" style="background: linear-gradient(135deg, #11998e, #38ef7d); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
            View Dashboard →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f1f3f5; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 13px; color: #888;">
          SmartQueue Management System • Automated Queue & Appointment System
        </p>
      </div>
    </div>
  `;

  sendEmail(doctorEmail, `📋 New Appointment — ${patientName} (Token #${token})`, html);
};

// ─── 3. TOKEN CALLED — NOTIFY PATIENT ───────────────────
const sendTokenCalledEmail = (patientEmail, patientName, token, doctorName) => {
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
          🔔 Your Turn Has Come!
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
          Please proceed to the doctor's cabin
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 35px 30px;">
        <p style="font-size: 17px; color: #333; margin: 0 0 20px;">
          Hello <strong>${patientName}</strong>,
        </p>

        <!-- Token Highlight -->
        <div style="text-align: center; margin: 25px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, #f093fb, #f5576c); padding: 25px 50px; border-radius: 16px;">
            <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 2px;">Your Token</p>
            <p style="margin: 5px 0 0; font-size: 48px; color: #fff; font-weight: 800;">#${token}</p>
          </div>
        </div>

        <!-- Info Card -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #f5576c;">
          <table style="width: 100%; font-size: 14px; color: #555;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Doctor:</td>
              <td style="padding: 8px 0;">Dr. ${doctorName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Status:</td>
              <td style="padding: 8px 0;">
                <span style="background: #ffeef0; color: #f5576c; padding: 3px 12px; border-radius: 12px; font-weight: 600; font-size: 13px;">
                  🟢 Now Calling
                </span>
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 15px; color: #555; line-height: 1.7; text-align: center; margin: 20px 0;">
          ⚡ Please proceed to <strong>Dr. ${doctorName}'s</strong> cabin immediately.
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #f1f3f5; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 13px; color: #888;">
          SmartQueue Management System • Automated Queue & Appointment System
        </p>
      </div>
    </div>
  `;

  sendEmail(patientEmail, `🔔 Your Token #${token} is Now Being Called!`, html);
};

// ─── 4. CONSULTATION COMPLETED — NOTIFY PATIENT (BONUS) ─
const sendConsultationCompletedEmail = (patientEmail, patientName, doctorName, diagnosis, prescription, token) => {
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
          ✅ Consultation Completed
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
          Your medical report is ready
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 35px 30px;">
        <p style="font-size: 17px; color: #333; margin: 0 0 20px;">
          Hello <strong>${patientName}</strong>,
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.7; margin: 0 0 25px;">
          Your consultation with <strong>Dr. ${doctorName}</strong> (Token #${token}) has been completed. Here is your medical summary:
        </p>

        <!-- Diagnosis Card -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 25px; margin-bottom: 15px; border-left: 4px solid #4facfe;">
          <h3 style="margin: 0 0 10px; color: #333; font-size: 15px;">🔍 Diagnosis</h3>
          <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.7; background: #f0f7ff; padding: 12px 15px; border-radius: 6px;">
            ${diagnosis}
          </p>
        </div>

        <!-- Prescription Card -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 25px; margin-bottom: 25px; border-left: 4px solid #00f2fe;">
          <h3 style="margin: 0 0 10px; color: #333; font-size: 15px;">💊 Prescription</h3>
          <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.7; background: #f0fffe; padding: 12px 15px; border-radius: 6px;">
            ${prescription}
          </p>
        </div>

        <p style="font-size: 14px; color: #777; line-height: 1.6;">
          You can also view your complete medical history from your patient dashboard.
        </p>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5000/dashboards/patient.html" style="background: linear-gradient(135deg, #4facfe, #00f2fe); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
            View Medical History →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f1f3f5; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 13px; color: #888;">
          SmartQueue Management System • Automated Queue & Appointment System
        </p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #aaa;">
          ⚠️ This is a system-generated email. For medical emergencies, please contact your doctor directly.
        </p>
      </div>
    </div>
  `;

  sendEmail(patientEmail, `✅ Consultation Report — Dr. ${doctorName} (Token #${token})`, html);
};

// ─── 5. WALK-IN PATIENT ADDED — NOTIFY DOCTOR ──────────
const sendWalkinBookedEmail = (doctorEmail, doctorName, patientName, token, symptoms) => {
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #ff9a56 0%, #ff6a00 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
          🚶 Walk-in Patient Added
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
          A walk-in patient has been added to your queue by staff
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 35px 30px;">
        <p style="font-size: 17px; color: #333; margin: 0 0 20px;">
          Hello <strong>Dr. ${doctorName}</strong>,
        </p>

        <!-- Appointment Card -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 25px; margin-bottom: 25px; border-left: 4px solid #ff6a00;">
          <h3 style="margin: 0 0 15px; color: #333; font-size: 16px;">🗓 Walk-in Patient Details</h3>
          <table style="width: 100%; font-size: 14px; color: #555;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; width: 130px;">Patient Name:</td>
              <td style="padding: 8px 0;">${patientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Token Number:</td>
              <td style="padding: 8px 0;">
                <span style="background: #ff6a00; color: #fff; padding: 4px 16px; border-radius: 20px; font-weight: 700; font-size: 16px;">
                  #${token}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Symptoms:</td>
              <td style="padding: 8px 0;">${symptoms || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Type:</td>
              <td style="padding: 8px 0;">
                <span style="background: #fff3e6; color: #ff6a00; padding: 3px 12px; border-radius: 12px; font-weight: 600; font-size: 13px;">
                  🚶 Walk-in
                </span>
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #777; line-height: 1.6;">
          This patient was added by the front desk staff. Please check your dashboard for the updated queue.
        </p>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5000/dashboards/doctor.html" style="background: linear-gradient(135deg, #ff9a56, #ff6a00); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
            View Dashboard →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f1f3f5; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 13px; color: #888;">
          SmartQueue Management System • Automated Queue & Appointment System
        </p>
      </div>
    </div>
  `;

  sendEmail(doctorEmail, `🚶 Walk-in Patient — ${patientName} (Token #${token})`, html);
};

// ─── 6. APPOINTMENT CANCELLED — NOTIFY PATIENT ──────────
const sendAppointmentCancelledEmail = (patientEmail, patientName, token, doctorName) => {
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 12px; overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #f85032 0%, #e73827 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">
          ❌ Appointment Cancelled
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">
          Your appointment has been successfully cancelled
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 35px 30px;">
        <p style="font-size: 17px; color: #333; margin: 0 0 20px;">
          Hello <strong>${patientName}</strong>,
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.7; margin: 0 0 25px;">
          This email is to confirm that your appointment with <strong>Dr. ${doctorName}</strong> (Token #${token}) has been cancelled by the administrative staff.
        </p>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5000/dashboards/patient.html" style="background: linear-gradient(135deg, #f85032, #e73827); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
            Book a New Appointment →
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f1f3f5; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 13px; color: #888;">
          SmartQueue Management System • Automated Queue & Appointment System
        </p>
      </div>
    </div>
  `;

  sendEmail(patientEmail, `❌ Appointment Cancelled — Dr. ${doctorName} (Token #${token})`, html);
};

module.exports = {
  sendRegistrationEmail,
  sendAppointmentBookedEmail,
  sendTokenCalledEmail,
  sendConsultationCompletedEmail,
  sendWalkinBookedEmail,
  sendAppointmentCancelledEmail
};
