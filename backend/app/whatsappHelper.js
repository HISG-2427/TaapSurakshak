const {
    Client,
    LocalAuth
} = require("whatsapp-web.js");

const qrcode = require("qrcode");

/*
============================================================
WHATSAPP STATE
============================================================
*/

let whatsappReady = false;
let currentQRCode = null;
let whatsappState = "INITIALIZING";
let whatsappError = null;


/*
============================================================
CHROME PATH
============================================================
*/

const chromePath = undefined;

console.log(
    "Puppeteer executable:",
    chromePath
);


/*
============================================================
WHATSAPP CLIENT
============================================================
*/

const whatsappClient = new Client({

    authStrategy: new LocalAuth({
        clientId: "taapsurakshak"
    }),

    authTimeoutMs: 60000,
    qrMaxRetries: 10,

    puppeteer: {
        headless: true,

        dumpio: true,

        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-features=Translate,BackForwardCache",
            "--disable-backgrounding-occluded-windows",
            "--disable-ipc-flooding-protection",
            "--no-first-run",
            "--no-default-browser-check"
        ]
    }

});

const originalInitialize = whatsappClient.initialize.bind(whatsappClient);


whatsappClient.initialize = async function () {

    console.log("🚀 WHATSAPP INITIALIZE STARTED");

    try {

        const result = await originalInitialize();

        console.log("✅ WHATSAPP INITIALIZE FINISHED");

        return result;

    } catch (error) {

        console.error("❌ WHATSAPP INITIALIZE FAILED");
        console.error("Name:", error?.name);
        console.error("Message:", error?.message);
        console.error("Stack:", error?.stack);

        throw error;

    }

};


whatsappClient.on("change_state", (state) => {
    console.log("📡 WhatsApp change_state:", state);
});

whatsappClient.on("disconnected", (reason) => {
    console.error("🔴 WhatsApp disconnected:", reason);
});

/*
============================================================
LOADING SCREEN
============================================================
*/

whatsappClient.on(
    "loading_screen",
    (percent, message) => {

        console.log(
            `WhatsApp loading: ${percent}% - ${message}`
        );

        if (!whatsappReady) {

            whatsappState =
                `LOADING_${percent}`;

        }

    }
);


/*
============================================================
QR CODE
============================================================
*/

whatsappClient.on(
    "qr",
    async (qr) => {

        console.log("");
        console.log("======================================");
        console.log("🔥 REAL WHATSAPP QR RECEIVED");
        console.log("======================================");
        console.log(
            "Scan with WhatsApp → Settings → Linked Devices"
        );
        console.log("======================================");
        console.log("");

        try {

            /*
            Convert the REAL WhatsApp QR string
            into an image data URL.
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
            Store the QR for the frontend.
            */

            currentQRCode =
                qrDataUrl;

            whatsappReady =
                false;

            whatsappState =
                "QR_REQUIRED";

            whatsappError =
                null;

            console.log(
                "✅ REAL WHATSAPP QR STORED"
            );

        } catch (error) {

            whatsappReady =
                false;

            currentQRCode =
                null;

            whatsappState =
                "ERROR";

            whatsappError =
                error.message;

            console.error(
                "❌ QR conversion error:",
                error
            );

        }

    }
);


/*
============================================================
AUTHENTICATED
============================================================
*/

whatsappClient.on(
    "authenticated",
    () => {

        console.log(
            "✅ WhatsApp authenticated successfully."
        );

        whatsappState =
            "AUTHENTICATED";

        whatsappError =
            null;

    }
);


/*
============================================================
READY
============================================================
*/

whatsappClient.on(
    "ready",
    () => {

        whatsappReady =
            true;

        currentQRCode =
            null;

        whatsappState =
            "READY";

        whatsappError =
            null;

        console.log(
            "======================================"
        );

        console.log(
            "✅ WHATSAPP CLIENT IS READY"
        );

        console.log(
            "======================================"
        );

    }
);


/*
============================================================
AUTH FAILURE
============================================================
*/

whatsappClient.on(
    "auth_failure",
    (message) => {

        console.log("");
        console.log("======================================");
        console.log("❌ WHATSAPP AUTH FAILURE");
        console.log("======================================");

        whatsappReady =
            false;

        currentQRCode =
            null;

        whatsappState =
            "AUTH_FAILURE";

        whatsappError =
            String(
                message ||
                "Authentication failed."
            );

        console.error(
            "Authentication failure:",
            message
        );

    }
);


/*
============================================================
DISCONNECTED
============================================================
*/

whatsappClient.on(
    "disconnected",
    (reason) => {

        console.log("");
        console.log("======================================");
        console.log("⚠️ WHATSAPP DISCONNECTED");
        console.log("======================================");

        whatsappReady =
            false;

        currentQRCode =
            null;

        whatsappState =
            "DISCONNECTED";

        whatsappError =
            String(
                reason ||
                "WhatsApp disconnected."
            );

        console.log(
            "Disconnect reason:",
            reason
        );

    }
);


/*
============================================================
STATE CHANGE
============================================================
*/

whatsappClient.on(
    "change_state",
    (state) => {

        console.log(
            "WhatsApp state changed:",
            state
        );

        if (!whatsappReady) {

            whatsappState =
                String(
                    state ||
                    "UNKNOWN"
                );

        }

    }
);


/*
============================================================
INITIALIZE WHATSAPP
============================================================
*/

if (
    process.env.ENABLE_WHATSAPP ===
    "true"
) {

    console.log("");
    console.log(
        "======================================"
    );
    console.log(
        "Starting WhatsApp client..."
    );
    console.log(
        "======================================"
    );

    console.log(
        "WhatsApp initialization started at:",
        new Date().toISOString()
    );

    console.log("🚀 ABOUT TO CALL whatsappClient.initialize()");

    const initStartedAt = Date.now();

    const https = require("https");

    whatsappClient.initialize()
        .then(() => {

            console.log(
                "✅ WhatsApp initialize() promise resolved after",
                Date.now() - initStartedAt,
                "ms"
            );

        })
        .catch((error) => {

            console.error("❌ WhatsApp initialize() REJECTED");
            console.error(error);

            whatsappReady = false;
            currentQRCode = null;
            whatsappState = "ERROR";
            whatsappError = error?.message || String(error);

        });

    setTimeout(() => {

        console.log(
            "⏱️ WhatsApp initialization has been running for 30 seconds."
        );

        console.log(
            "Current WhatsApp state:",
            whatsappState
        );

        console.log(
            "Current QR exists:",
            Boolean(currentQRCode)
        );

        console.log(
            "WhatsApp ready:",
            whatsappReady
        );

    }, 30000);

    setTimeout(() => {

        console.log(
            "⏱️ WhatsApp initialization has been running for 90 seconds."
        );

        console.log(
            "Current WhatsApp state:",
            whatsappState
        );

        console.log(
            "Current QR exists:",
            Boolean(currentQRCode)
        );

        console.log(
            "WhatsApp ready:",
            whatsappReady
        );

    }, 90000);

} else {

    whatsappState =
        "DISABLED";

    console.log(
        "WhatsApp disabled."
    );

}


/*
============================================================
GET WHATSAPP STATUS
============================================================
*/

function getWhatsAppStatus() {

    return {

        enabled:
            process.env.ENABLE_WHATSAPP ===
            "true",

        ready:
            whatsappReady,

        state:
            whatsappState,

        qr:
            currentQRCode,

        error:
            whatsappError

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


    /*
    Indian 10-digit number
    */

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

    /*
    Check whether WhatsApp
    notifications are enabled.
    */

    if (
        process.env.ENABLE_WHATSAPP !==
        "true"
    ) {

        throw new Error(
            "WhatsApp notifications are disabled on this server."
        );

    }


    /*
    Check WhatsApp connection.
    */

    if (!whatsappReady) {

        throw new Error(
            "WhatsApp is not connected. Please scan the QR code first and wait for the connected message."
        );

    }


    /*
    Format recipient number.
    */

    const chatId =
        formatWhatsAppNumber(
            phoneNumber
        );


    /*
    Check whether the number
    is registered on WhatsApp.
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
    Create WhatsApp message.
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
    Send message.
    */

    const sentMessage =
        await whatsappClient
            .sendMessage(
                chatId,
                message
            );


    console.log(
        "======================================"
    );

    console.log(
        "✅ WhatsApp message sent successfully"
    );

    console.log(
        "Recipient:",
        phoneNumber
    );

    console.log(
        "Message ID:",
        sentMessage?.id?._serialized ||
        "sent"
    );

    console.log(
        "======================================"
    );


    return {

        success:
            true,

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