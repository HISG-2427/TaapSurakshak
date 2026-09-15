const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

// ============================================================
// WHATSAPP STATE
// ============================================================

let whatsappClient = null;

let whatsappReady = false;

let currentQRCode = null;


// ============================================================
// INITIALIZE WHATSAPP
// ============================================================

if (process.env.ENABLE_WHATSAPP === "true") {

    console.log("📱 Starting WhatsApp service...");

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
                "--disable-gpu"
            ]

        }

    });


    // ========================================================
    // QR CODE GENERATED
    // ========================================================

    whatsappClient.on(
        "qr",
        async (qr) => {

            try {

                console.log(
                    "📱 WhatsApp QR code generated."
                );

                whatsappReady = false;


                // Convert WhatsApp authentication QR
                // into a browser-displayable image

                currentQRCode =
                    await qrcode.toDataURL(qr);


                console.log(
                    "📱 WhatsApp QR ready for Alerts page."
                );

            } catch (error) {

                console.error(
                    "❌ Failed to generate WhatsApp QR:",
                    error
                );

            }

        }
    );


    // ========================================================
    // LOADING SCREEN
    // ========================================================
    // This is important for debugging after QR scanning.

    whatsappClient.on(
        "loading_screen",
        (percent, message) => {

            console.log(
                `⏳ WhatsApp loading: ${percent}% - ${message}`
            );

        }
    );


    // ========================================================
    // AUTHENTICATED
    // ========================================================

    whatsappClient.on(
        "authenticated",
        () => {

            console.log(
                "✅ WhatsApp authenticated successfully."
            );

            // Authentication has succeeded.
            // Client may still be loading, so DON'T mark
            // whatsappReady=true here.

        }
    );


    // ========================================================
    // READY
    // ========================================================

    whatsappClient.on(
        "ready",
        () => {

            console.log(
                "✅ WhatsApp client is READY."
            );

            whatsappReady = true;

            // QR is no longer needed
            currentQRCode = null;

        }
    );


    // ========================================================
    // CHANGE STATE
    // ========================================================
    // Helps diagnose cases where WhatsApp authenticates
    // but never reaches READY.

    whatsappClient.on(
        "change_state",
        (state) => {

            console.log(
                "🔄 WhatsApp state changed:",
                state
            );

        }
    );


    // ========================================================
    // AUTH FAILURE
    // ========================================================

    whatsappClient.on(
        "auth_failure",
        (message) => {

            console.error(
                "❌ WhatsApp authentication failure:",
                message
            );

            whatsappReady = false;

            currentQRCode = null;

        }
    );


    // ========================================================
    // DISCONNECTED
    // ========================================================

    whatsappClient.on(
        "disconnected",
        (reason) => {

            console.log(
                "⚠️ WhatsApp disconnected:",
                reason
            );

            whatsappReady = false;

            currentQRCode = null;

        }
    );


    // ========================================================
    // INITIALIZE CLIENT
    // ========================================================

    console.log(
        "🚀 Initializing WhatsApp client..."
    );

    whatsappClient
        .initialize()
        .catch((error) => {

            console.error(
                "❌ WhatsApp initialization failed:",
                error
            );

            whatsappReady = false;

        });


} else {

    console.log(
        "⚠️ WhatsApp disabled."
    );

    console.log(
        "Set ENABLE_WHATSAPP=true to enable WhatsApp linking."
    );

}


// ============================================================
// GET WHATSAPP STATUS
// IMPORTANT: app.js uses this function
// ============================================================

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


// ============================================================
// GET WHATSAPP QR CODE
// ============================================================

function getWhatsAppQRCode() {

    return currentQRCode;

}


// ============================================================
// CHECK WHATSAPP READY
// ============================================================

function isWhatsAppReady() {

    return whatsappReady;

}


// ============================================================
// SEND WHATSAPP FEEDBACK
// ============================================================

async function sendWhatsAppFeedback(
    phoneNumber,
    name,
    temperature,
    riskLevel,
    suggestion
) {

    // --------------------------------------------------------
    // Check WhatsApp client
    // --------------------------------------------------------

    if (!whatsappClient) {

        throw new Error(
            "WhatsApp service is disabled."
        );

    }


    // --------------------------------------------------------
    // Check authentication / ready state
    // --------------------------------------------------------

    if (!whatsappReady) {

        throw new Error(
            "WhatsApp is not ready. Scan the QR code first."
        );

    }


    // --------------------------------------------------------
    // Clean phone number
    // --------------------------------------------------------

    let number =
        String(phoneNumber)
            .replace(/\D/g, "");


    // --------------------------------------------------------
    // Indian 10-digit number
    // automatically gets +91
    // --------------------------------------------------------

    if (number.length === 10) {

        number =
            "91" + number;

    }


    // --------------------------------------------------------
    // WhatsApp chat ID
    // --------------------------------------------------------

    const chatId =
        `${number}@c.us`;


    // --------------------------------------------------------
    // Message
    // --------------------------------------------------------

    const message =
        `🔥 TaapSurakshak Heat Alert

Hello ${name},

🌡️ Temperature: ${temperature} °C
⚠️ Risk Level: ${riskLevel}

${suggestion}

Please follow heat-safety precautions and stay hydrated.

— TaapSurakshak`;


    // --------------------------------------------------------
    // Send message
    // --------------------------------------------------------

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


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    sendWhatsAppFeedback,

    isWhatsAppReady,

    getWhatsAppStatus,

    getWhatsAppQRCode

};