/*
============================================================
PROCESS ERROR LOGGING
============================================================
*/

process.on("exit", (code) => {
    console.log("🛑 NODE PROCESS EXITED WITH CODE:", code);
});

process.on("SIGTERM", () => {
    console.log("🛑 NODE RECEIVED SIGTERM");
});

process.on("SIGINT", () => {
    console.log("🛑 NODE RECEIVED SIGINT");
});

process.on("uncaughtException", (error) => {
    console.error("💥 UNCAUGHT EXCEPTION:");
    console.error(error);
});

process.on("unhandledRejection", (reason) => {
    console.error("💥 UNHANDLED REJECTION:");
    console.error(reason);
});


/*
============================================================
ENVIRONMENT CHECK
============================================================
*/

const isVercel =
    process.env.VERCEL === "1";

const whatsappEnabledByEnv =
    process.env.ENABLE_WHATSAPP === "true";


/*
============================================================
WHATSAPP ENABLED CHECK
============================================================

WhatsApp is NEVER started on Vercel.

Even if someone accidentally sets:

ENABLE_WHATSAPP=true

inside Vercel, WhatsApp will still remain disabled.
============================================================
*/

const whatsappEnabled =
    whatsappEnabledByEnv &&
    !isVercel;


console.log("");
console.log("======================================");
console.log("📱 TAAPSURAKSHAK WHATSAPP CONFIG");
console.log("======================================");
console.log(
    "Environment:",
    isVercel ? "VERCEL" : "PERSISTENT SERVER"
);
console.log(
    "ENABLE_WHATSAPP:",
    process.env.ENABLE_WHATSAPP
);
console.log(
    "WhatsApp enabled:",
    whatsappEnabled
);
console.log("======================================");
console.log("");


/*
============================================================
WHATSAPP STATE
============================================================
*/

let whatsappReady = false;

let currentQRCode = null;

let whatsappState =
    whatsappEnabled
        ? "INITIALIZING"
        : "DISABLED";

let whatsappError = null;


/*
============================================================
WHATSAPP CLIENT
============================================================

CRITICAL:

Do NOT create LocalAuth on Vercel.

The require() and Client creation are inside the
whatsappEnabled condition.

Therefore Vercel will never execute:

new LocalAuth(...)

and will never try to create:

/var/task/.wwebjs_auth/
============================================================
*/

let whatsappClient = null;

let qrcode = null;


if (whatsappEnabled) {

    console.log(
        "🚀 Loading whatsapp-web.js..."
    );

    const {
        Client,
        LocalAuth
    } = require("whatsapp-web.js");

    qrcode = require("qrcode");


    /*
    ========================================================
    CREATE WHATSAPP CLIENT
    ========================================================
    */

    whatsappClient = new Client({

        authStrategy: new LocalAuth({

            clientId:
                "taapsurakshak"

        }),

        authTimeoutMs: 0,

        qrMaxRetries: 10,

        webVersionCache: {

            type: "remote",

            remotePath:
                "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1043191242-alpha.html"

        },

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

                "--no-first-run",

                "--no-default-browser-check",

                "--disable-background-networking",

                "--disable-background-timer-throttling",

                "--disable-renderer-backgrounding",

                "--disable-backgrounding-occluded-windows",

                "--disable-ipc-flooding-protection",

                "--disable-features=Translate,BackForwardCache"

            ]

        }

    });


    /*
    ========================================================
    INITIALIZE WRAPPER
    ========================================================
    */

    const originalInitialize =
        whatsappClient.initialize.bind(
            whatsappClient
        );


    whatsappClient.initialize =
        async function () {

            console.log(
                "🚀 WHATSAPP INITIALIZE STARTED"
            );

            try {

                const result =
                    await originalInitialize();

                console.log(
                    "✅ WHATSAPP INITIALIZE FINISHED"
                );

                return result;

            } catch (error) {

                console.error(
                    "❌ WHATSAPP INITIALIZE FAILED"
                );

                console.error(
                    "Name:",
                    error?.name
                );

                console.error(
                    "Message:",
                    error?.message
                );

                console.error(
                    "Stack:",
                    error?.stack
                );


                whatsappReady =
                    false;

                currentQRCode =
                    null;

                whatsappState =
                    "ERROR";

                whatsappError =
                    error?.message ||
                    String(error);


                throw error;

            }

        };


    /*
    ========================================================
    LOADING SCREEN
    ========================================================
    */

    whatsappClient.on(
        "loading_screen",
        (percent, message) => {

            console.log(
                `📱 WhatsApp loading: ${percent}% - ${message}`
            );


            if (!whatsappReady) {

                whatsappState =
                    `LOADING_${percent}`;

            }

        }
    );


    /*
    ========================================================
    STATE CHANGE
    ========================================================
    */

    whatsappClient.on(
        "change_state",
        (state) => {

            console.log(
                "📡 WhatsApp state changed:",
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
    ========================================================
    QR CODE
    ========================================================
    */

    whatsappClient.on(
        "qr",
        async (qr) => {

            console.log("");

            console.log(
                "======================================"
            );

            console.log(
                "🔥 REAL WHATSAPP QR RECEIVED"
            );

            console.log(
                "======================================"
            );

            console.log(
                "Scan with WhatsApp → Settings → Linked Devices"
            );

            console.log(
                "======================================"
            );

            console.log("");


            try {

                /*
                Convert the REAL WhatsApp QR string
                into an image Data URL.
                */

                const qrDataUrl =
                    await qrcode.toDataURL(
                        qr,
                        {
                            errorCorrectionLevel:
                                "M",

                            margin:
                                2,

                            width:
                                320
                        }
                    );


                /*
                Store QR for frontend.
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
                    error?.message ||
                    String(error);


                console.error(
                    "❌ QR conversion error:",
                    error
                );

            }

        }
    );


    /*
    ========================================================
    AUTHENTICATED
    ========================================================
    */

    whatsappClient.on(
        "authenticated",
        () => {

            console.log("");

            console.log(
                "======================================"
            );

            console.log(
                "🔐 WHATSAPP AUTHENTICATED"
            );

            console.log(
                "======================================"
            );


            whatsappState =
                "AUTHENTICATED";


            whatsappError =
                null;


            /*
            Render/WhatsApp Web can sometimes authenticate
            without firing "ready" immediately.

            Keep the existing behavior of treating
            successful authentication as connected.
            */

            whatsappReady =
                true;


            currentQRCode =
                null;


            console.log(
                "✅ WHATSAPP MARKED AS READY AFTER AUTHENTICATION"
            );

        }
    );


    /*
    ========================================================
    READY
    ========================================================
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


            console.log("");

            console.log(
                "======================================"
            );

            console.log(
                "✅ WHATSAPP CLIENT IS READY"
            );

            console.log(
                "======================================"
            );

            console.log("");

        }
    );


    /*
    ========================================================
    AUTH FAILURE
    ========================================================
    */

    whatsappClient.on(
        "auth_failure",
        (message) => {

            console.log("");

            console.log(
                "======================================"
            );

            console.log(
                "❌ WHATSAPP AUTH FAILURE"
            );

            console.log(
                "======================================"
            );


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
    ========================================================
    DISCONNECTED
    ========================================================
    */

    whatsappClient.on(
        "disconnected",
        (reason) => {

            console.log("");

            console.log(
                "======================================"
            );

            console.log(
                "⚠️ WHATSAPP DISCONNECTED"
            );

            console.log(
                "======================================"
            );


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
    ========================================================
    INITIALIZE WHATSAPP
    ========================================================
    */

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


    console.log(
        "🚀 ABOUT TO CALL whatsappClient.initialize()"
    );


    const initStartedAt =
        Date.now();


    whatsappClient
        .initialize()

        .then(() => {

            console.log(
                "✅ WhatsApp initialize() promise resolved after",
                Date.now() - initStartedAt,
                "ms"
            );

        })

        .catch((error) => {

            console.error(
                "❌ WhatsApp initialize() REJECTED"
            );


            console.error(
                "Name:",
                error?.name
            );


            console.error(
                "Message:",
                error?.message
            );


            console.error(
                "Stack:",
                error?.stack
            );


            whatsappReady =
                false;


            currentQRCode =
                null;


            whatsappState =
                "ERROR";


            whatsappError =
                error?.message ||
                String(error);

        });


    /*
    ========================================================
    30 SECOND DIAGNOSTIC
    ========================================================
    */

    setTimeout(() => {

        console.log("");

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


    /*
    ========================================================
    90 SECOND DIAGNOSTIC
    ========================================================
    */

    setTimeout(() => {

        console.log("");

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

    /*
    ========================================================
    WHATSAPP DISABLED
    ========================================================
    */

    whatsappReady =
        false;

    currentQRCode =
        null;

    whatsappState =
        isVercel
            ? "DISABLED_ON_VERCEL"
            : "DISABLED";

    whatsappError =
        null;


    console.log("");

    console.log(
        "======================================"
    );

    console.log(
        isVercel
            ? "☁️ VERCEL DETECTED"
            : "📱 WHATSAPP DISABLED"
    );

    console.log(
        "======================================"
    );


    if (isVercel) {

        console.log(
            "WhatsApp Web will NOT start on Vercel."
        );

        console.log(
            "LocalAuth will NOT be initialized."
        );

        console.log(
            "WhatsApp should run on the persistent server."
        );

    } else {

        console.log(
            "WhatsApp disabled because ENABLE_WHATSAPP is not true."
        );

    }


    console.log(
        "======================================"
    );

    console.log("");

}


/*
============================================================
GET WHATSAPP STATUS
============================================================
*/

function getWhatsAppStatus() {

    return {

        enabled:
            whatsappEnabled,

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
FORMAT WHATSAPP NUMBER
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

    if (!whatsappEnabled) {

        throw new Error(
            isVercel
                ? "WhatsApp is not available on Vercel. WhatsApp is running on the persistent WhatsApp server."
                : "WhatsApp notifications are disabled on this server."
        );

    }


    /*
    Check WhatsApp client.
    */

    if (!whatsappClient) {

        throw new Error(
            "WhatsApp client is not initialized."
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
    ========================================================
    SEND MESSAGE
    ========================================================
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