const twilio = require("twilio");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function sendSMSFeedback(
    phoneNumber,
    name,
    heatRisk,
    mortalityRisk
) {
    const contentSid = process.env.TWILIO_CONTENT_SID;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    console.log("Twilio parameter check:", {
        hasTo: Boolean(phoneNumber),
        hasFrom: Boolean(fromNumber),
        hasContentSid: Boolean(contentSid),
        hasName: Boolean(name),
        hasHeatRisk: heatRisk !== undefined && heatRisk !== null,
        hasMortalityRisk:
            mortalityRisk !== undefined && mortalityRisk !== null
    });

    if (!phoneNumber) {
        throw new Error("Twilio `to` number is missing.");
    }

    if (!fromNumber) {
        throw new Error("Twilio `from` number is missing.");
    }

    if (!contentSid) {
        throw new Error("TWILIO_CONTENT_SID is missing.");
    }

    const contentVariables = JSON.stringify({
        "1": String(name || ""),
        "2": Number(heatRisk).toFixed(2),
        "3": Number(mortalityRisk).toFixed(2)
    });

    console.log("Sending SMS:", {
        to: phoneNumber,
        hasContentVariables: Boolean(contentVariables)
    });

    try {
        const sms = await client.messages.create({
            to: phoneNumber,
            from: fromNumber,
            contentSid: contentSid,
            contentVariables: contentVariables
        });

        console.log("Twilio response:", {
            sid: sms.sid,
            status: sms.status
        });

        return sms;
    } catch (error) {
        console.error("Twilio SMS error:", {
            message: error.message,
            code: error.code,
            status: error.status
        });

        throw error;
    }
}

module.exports = { sendSMSFeedback };