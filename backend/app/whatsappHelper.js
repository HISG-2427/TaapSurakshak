const {
    Client,
    LocalAuth
} = require("whatsapp-web.js");

const qrcode = require("qrcode-terminal");

let whatsappReady = false;

const whatsappClient = new Client({
    authStrategy: new LocalAuth({
        clientId: "taapsurakshak"
    }),

    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
        ]
    }
});

whatsappClient.on("qr", (qr) => {
    console.log("\n======================================");
    console.log("SCAN THIS QR CODE WITH WHATSAPP");
    console.log("WhatsApp → Settings → Linked Devices");
    console.log("======================================\n");

    qrcode.generate(qr, {
        small: true
    });
});

whatsappClient.on("authenticated", () => {
    console.log("WhatsApp authenticated successfully.");
});

whatsappClient.on("ready", () => {
    whatsappReady = true;
    console.log("WhatsApp client is ready.");
});

whatsappClient.on("auth_failure", (message) => {
    whatsappReady = false;
    console.error("WhatsApp authentication failed:", message);
});

whatsappClient.on("disconnected", (reason) => {
    whatsappReady = false;
    console.log("WhatsApp disconnected:", reason);
});

whatsappClient.initialize();

function formatWhatsAppNumber(phoneNumber) {
    const cleanedNumber = String(phoneNumber || "")
        .replace(/[^\d]/g, "");

    if (!cleanedNumber) {
        throw new Error("WhatsApp phone number is missing.");
    }

    return `${cleanedNumber}@c.us`;
}

async function sendWhatsAppFeedback(
    phoneNumber,
    name,
    heatRisk,
    mortalityRisk,
    riskLevel = "UNKNOWN",
    suggestion = ""
) {
    if (!whatsappReady) {
        throw new Error(
            "WhatsApp is not ready. Scan the QR code in the terminal first."
        );
    }

    const chatId = formatWhatsAppNumber(phoneNumber);

    const exists = await whatsappClient.isRegisteredUser(chatId);

    if (!exists) {
        throw new Error(
            `The number ${phoneNumber} is not registered on WhatsApp.`
        );
    }

    const formattedHeatRisk = Number(heatRisk).toFixed(2);
    const formattedMortalityRisk = Number(mortalityRisk).toFixed(2);

    const message = [
        "🌡️ *TaapSurakshak Heat Health Alert*",
        "",
        `Hello ${name || "User"},`,
        "",
        `🔥 Heat risk: ${formattedHeatRisk}`,
        `⚠️ Mortality index: ${formattedMortalityRisk}`,
        `📊 Risk level: *${riskLevel}*`,
        "",
        suggestion ||
        "Stay hydrated, avoid unnecessary outdoor exposure, and take breaks in a cool or shaded place.",
        "",
        "This is an automated health-safety notification from TaapSurakshak."
    ].join("\n");

    const sentMessage = await whatsappClient.sendMessage(
        chatId,
        message
    );

    console.log("WhatsApp message sent successfully:", {
        recipient: phoneNumber,
        messageId: sentMessage.id.id
    });

    return sentMessage;
}

function isWhatsAppReady() {
    return whatsappReady;
}

module.exports = {
    sendWhatsAppFeedback,
    isWhatsAppReady
};