const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

let whatsappClient = null;
let whatsappReady = false;
let currentQRCode = null;

console.log("==========================================");
console.log("📱 WHATSAPP SERVICE STARTING");
console.log("ENABLE_WHATSAPP =", process.env.ENABLE_WHATSAPP);
console.log("==========================================");

if (process.env.ENABLE_WHATSAPP === "true") {

    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: "./.wwebjs_auth"
        }),

        puppeteer: {
            headless: true,

            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding"
            ]
        }
    });

    // ==========================================
    // QR CODE
    // ==========================================

    whatsappClient.on("qr", async (qr) => {

        console.log("==========================================");
        console.log("📱 QR EVENT RECEIVED!");
        console.log("QR STRING LENGTH:", qr ? qr.length : 0);
        console.log("==========================================");

        try {

            whatsappReady = false;

            currentQRCode = await qrcode.toDataURL(qr);

            console.log("✅ QR DATA URL GENERATED");
            console.log(
                "QR DATA LENGTH:",
                currentQRCode ? currentQRCode.length : 0
            );

        } catch (error) {

            console.error(
                "❌ QR conversion failed:",
                error
            );

            currentQRCode = null;
        }
    });


    // ==========================================
    // LOADING
    // ==========================================

    whatsappClient.on(
        "loading_screen",
        (percent, message) => {

            console.log(
                `⏳ WhatsApp loading: ${percent}% - ${message}`
            );

        }
    );


    // ==========================================
    // AUTHENTICATED
    // ==========================================

    whatsappClient.on("authenticated", () => {

        console.log("==========================================");
        console.log("✅ WHATSAPP AUTHENTICATED");
        console.log("==========================================");

    });


    // ==========================================
    // READY
    // ==========================================

    whatsappClient.on("ready", () => {

        console.log("==========================================");
        console.log("✅ WHATSAPP CLIENT READY");
        console.log("==========================================");

        whatsappReady = true;

        // QR is no longer needed after authentication
        currentQRCode = null;
    });


    // ==========================================
    // STATE CHANGE
    // ==========================================

    whatsappClient.on("change_state", (state) => {

        console.log(
            "🔄 WhatsApp state changed:",
            state
        );

    });


    // ==========================================
    // AUTH FAILURE
    // ==========================================

    whatsappClient.on("auth_failure", (message) => {

        console.error(
            "❌ WhatsApp authentication failure:",
            message
        );

        whatsappReady = false;
        currentQRCode = null;
    });


    // ==========================================
    // DISCONNECTED
    // ==========================================

    whatsappClient.on("disconnected", (reason) => {

        console.log(
            "⚠️ WhatsApp disconnected:",
            reason
        );

        whatsappReady = false;
        currentQRCode = null;
    });


    // ==========================================
    // INITIALIZE
    // ==========================================

    console.log("🚀 Initializing WhatsApp client...");

    whatsappClient
        .initialize()
        .then(() => {

            console.log(
                "🚀 WhatsApp initialize() completed."
            );

        })
        .catch((error) => {

            console.error(
                "❌ WhatsApp initialization failed:",
                error
            );

            whatsappReady = false;
            currentQRCode = null;
        });

} else {

    console.log("⚠️ WhatsApp is disabled.");
    console.log(
        "Set ENABLE_WHATSAPP=true in Render Environment Variables."
    );
}


// ==========================================
// STATUS
// ==========================================

function getWhatsAppStatus() {

    return {
        enabled:
            process.env.ENABLE_WHATSAPP === "true",

        ready:
            whatsappReady,

        qr:
            currentQRCode
    };
}


// ==========================================
// QR
// ==========================================

function getWhatsAppQRCode() {

    return currentQRCode;
}


// ==========================================
// READY CHECK
// ==========================================

function isWhatsAppReady() {

    return whatsappReady;
}


// ==========================================
// SEND MESSAGE
// ==========================================

async function sendWhatsAppFeedback(
    phoneNumber,
    name,
    temperature,
    riskLevel,
    suggestion
) {

    if (!whatsappClient) {

        throw new Error(
            "WhatsApp service is disabled."
        );

    }


    if (!whatsappReady) {

        throw new Error(
            "WhatsApp is not ready. Scan the QR code first."
        );

    }


    let number =
        String(phoneNumber)
            .replace(/\D/g, "");


    if (number.length === 10) {

        number = "91" + number;

    }


    const chatId =
        `${number}@c.us`;


    const message =
`🔥 TaapSurakshak Heat Alert

Hello ${name},

🌡️ Temperature: ${temperature} °C
⚠️ Risk Level: ${riskLevel}

${suggestion}

Please follow heat-safety precautions and stay hydrated.

— TaapSurakshak`;


    try {

        const result =
            await whatsappClient.sendMessage(
                chatId,
                message
            );

        console.log(
            `✅ WhatsApp alert sent to ${number}`
        );

        return result;

    } catch (error) {

        console.error(
            `❌ Failed to send WhatsApp alert to ${number}:`,
            error
        );

        throw error;

    }
}


module.exports = {

    sendWhatsAppFeedback,

    isWhatsAppReady,

    getWhatsAppStatus,

    getWhatsAppQRCode

};