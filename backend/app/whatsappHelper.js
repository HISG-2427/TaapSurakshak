const {
    Client,
    LocalAuth
} = require("whatsapp-web.js");

const qrcode = require("qrcode");

let whatsappReady = false;
let currentQRCode = null;
let whatsappState = "INITIALIZING";
let whatsappError = null;

console.log(
    "Puppeteer executable:",
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "/opt/render/project/src/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome"
);

/*
============================================================
WHATSAPP CLIENT
============================================================
*/

const whatsappClient = new Client({

    puppeteer: {
        headless: true,

        executablePath:
            process.env.PUPPETEER_EXECUTABLE_PATH ||
            "/opt/render/project/src/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome",

        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-extensions",
            "--no-first-run",
            "--no-zygote",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-features=Translate,BackForwardCache"
        ]
    }

});


whatsappClient.on(
    "qr",
    async (qr) => {

        console.log("");
        console.log("======================================");
        console.log("REAL WHATSAPP QR RECEIVED");
        console.log("======================================");
        console.log(
            "Scan with WhatsApp → Settings → Linked Devices"
        );
        console.log("======================================");
        console.log("");

        try {

            /*
             * Convert the REAL WhatsApp Web QR string
             * into an image data URL.
             */

            const qrDataUrl =
                await qrcode.toDataURL(
                    qr,
                    {
                        errorCorrectionLevel: "M",
                        margin: 2,
                        width: 320
                    }
                );


            /*
             * IMPORTANT:
             *
             * This is the ONLY place where the QR
             * is replaced.
             */

            currentQRCode = qrDataUrl;

            whatsappReady = false;

            whatsappState =
                "QR_REQUIRED";

            whatsappError = null;


            console.log(
                "REAL WHATSAPP QR STORED"
            );

        } catch (error) {

            whatsappReady = false;

            whatsappState =
                "ERROR";

            whatsappError =
                error.message;

            console.error(
                "QR conversion error:",
                error
            );

        }

    }
);
whatsappClient.on("loading_screen", (percent, message) => {
    console.log(
        `⏳ WhatsApp loading: ${percent}% - ${message}`
    );
});


whatsappClient.on("change_state", (state) => {
    console.log(
        "🔄 WhatsApp state:",
        state
    );

    if (!whatsappReady) {
        whatsappState = String(state || "UNKNOWN");
    }
});

whatsappClient.on("authenticated", () => {
    console.log("");
    console.log("======================================");
    console.log("🔐 WHATSAPP AUTHENTICATED");
    console.log("======================================");

    whatsappState = "AUTHENTICATED";
    whatsappError = null;
});


whatsappClient.on("ready", () => {
    console.log("");
    console.log("======================================");
    console.log("✅ WHATSAPP READY");
    console.log("======================================");

    whatsappReady = true;
    currentQRCode = null;
    whatsappState = "READY";
    whatsappError = null;
});


whatsappClient.on("auth_failure", (message) => {
    console.log("");
    console.log("======================================");
    console.log("❌ WHATSAPP AUTH FAILURE");
    console.log("======================================");

    whatsappReady = false;
    currentQRCode = null;
    whatsappState = "AUTH_FAILURE";
    whatsappError = String(
        message || "Authentication failed."
    );

    console.error(
        "Authentication failure:",
        message
    );
});


whatsappClient.on("disconnected", (reason) => {
    console.log("");
    console.log("======================================");
    console.log("⚠️ WHATSAPP DISCONNECTED");
    console.log("======================================");

    whatsappReady = false;
    currentQRCode = null;
    whatsappState = "DISCONNECTED";
    whatsappError = String(
        reason || "WhatsApp disconnected."
    );

    console.log(
        "Disconnect reason:",
        reason
    );
});

/*
============================================================
INITIALIZE WHATSAPP
============================================================
*/

if (
    process.env.ENABLE_WHATSAPP ===
    "true"
) {

    console.log("Starting WhatsApp client...");
    console.log("WhatsApp initialization started at:", new Date().toISOString());

    whatsappClient.initialize()
        .then(() => {
            console.log("WhatsApp initialize() promise resolved.");
        })
        .catch((error) => {
            whatsappReady = false;
            whatsappState = "ERROR";
            whatsappError = error.message;

            console.error(
                "WhatsApp initialization failed:",
                error
            );
        });
    console.log("WhatsApp initialize() called. Waiting for WhatsApp Web...");

} else {

    whatsappState =
        "DISABLED";

    console.log(
        "WhatsApp disabled."
    );

}


function getWhatsAppStatus() {
    return {
        enabled: process.env.ENABLE_WHATSAPP === "true",
        ready: whatsappReady,
        state: whatsappState,
        qr: currentQRCode,
        error: whatsappError
    };
}


/*
============================================================
FORMAT PHONE NUMBER
============================================================
*/

function formatWhatsAppNumber(
    phoneNumber
) {

    let cleanedNumber =
        String(
            phoneNumber ||
            ""
        )
            .replace(
                /[^\d]/g,
                ""
            );


    if (!cleanedNumber) {

        throw new Error(
            "WhatsApp phone number is missing."
        );

    }

    if (
        cleanedNumber.length ===
        10
    ) {

        cleanedNumber =
            `91${cleanedNumber}`;

    }


    return `${cleanedNumber}@c.us`;

}


/*
============================================================
SEND WHATSAPP MESSAGE
============================================================
*/

async function sendWhatsAppFeedback(

    phoneNumber,

    name,

    temperature,

    riskLevel = "UNKNOWN",

    suggestion = ""

) {

    if (
        process.env.ENABLE_WHATSAPP !==
        "true"
    ) {

        throw new Error(
            "WhatsApp notifications are disabled on this server."
        );

    }


    if (!whatsappReady) {

        throw new Error(
            "WhatsApp is not connected. Please scan the QR code first and wait for the connected message."
        );

    }


    const chatId =
        formatWhatsAppNumber(
            phoneNumber
        );


    /*
     * Check whether the number
     * actually has WhatsApp.
     */

    const exists =
        await whatsappClient
            .isRegisteredUser(
                chatId
            );


    if (!exists) {

        throw new Error(
            `The number ${phoneNumber} is not registered on WhatsApp.`
        );

    }


    /*
     * Message
     */

    const message = [

        "🔥 *TaapSurakshak Heat Alert*",

        "",

        `Hello ${name || "User"},`,

        "",

        `🌡️ Temperature: *${Number(
            temperature
        ).toFixed(1)}°C*`,

        `⚠️ Overall Risk Level: *${riskLevel}*`,

        "",

        "💡 *Recommendation:*",

        suggestion ||
        "Stay hydrated, avoid unnecessary outdoor exposure, and take breaks in a cool or shaded place.",

        "",

        "This is an automated health-safety notification from TaapSurakshak."

    ].join("\n");


    /*
     * Send message
     */

    const sentMessage =
        await whatsappClient
            .sendMessage(
                chatId,
                message
            );


    console.log(
        "WhatsApp message sent successfully:",
        {

            recipient:
                phoneNumber,

            messageId:
                sentMessage?.id?._serialized ||
                "sent"

        }
    );


    return {

        success: true,

        messageId:
            sentMessage?.id?._serialized ||
            null

    };

}


/*
============================================================
READY CHECK
============================================================
*/

function isWhatsAppReady() {

    return whatsappReady;

}


/*
============================================================
EXPORTS
============================================================
*/

module.exports = {

    sendWhatsAppFeedback,

    isWhatsAppReady,

    getWhatsAppStatus

};