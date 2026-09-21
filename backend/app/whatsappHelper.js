/*
============================================================
TAAPSURAKSHAK - VERCEL WHATSAPP PROXY
============================================================

Vercel does NOT run whatsapp-web.js.

Instead:

Vercel
   ↓
WHATSAPP_SERVER_URL
   ↓
Your PC
   ↓
whatsapp-web.js
   ↓
WhatsApp Web

The QR generated on your PC is returned through this API
and displayed on the Vercel Alerts page.
============================================================
*/

const WHATSAPP_SERVER_URL =
    process.env.WHATSAPP_SERVER_URL || "";


/*
============================================================
CONFIG
============================================================
*/

const whatsappProxyEnabled =
    Boolean(WHATSAPP_SERVER_URL);


console.log("");
console.log("======================================");
console.log("📱 TAAPSURAKSHAK WHATSAPP PROXY");
console.log("======================================");

console.log(
    "WhatsApp server:",
    WHATSAPP_SERVER_URL || "NOT CONFIGURED"
);

console.log(
    "Proxy enabled:",
    whatsappProxyEnabled
);

console.log("======================================");
console.log("");


/*
============================================================
INTERNAL REQUEST HELPER
============================================================
*/

async function whatsappRequest(
    endpoint,
    options = {}
) {

    if (!WHATSAPP_SERVER_URL) {

        throw new Error(
            "WHATSAPP_SERVER_URL is not configured in Vercel."
        );

    }


    const url =
        `${WHATSAPP_SERVER_URL}${endpoint}`;


    console.log(
        "📡 WhatsApp proxy request:",
        url
    );


    let response;

    try {

        response =
            await fetch(
                url,
                {

                    ...options,

                    headers: {

                        "Content-Type":
                            "application/json",

                        ...(options.headers || {})

                    }

                }
            );

    } catch (error) {

        console.error(
            "❌ Could not reach WhatsApp server:",
            error
        );

        throw new Error(
            "Could not connect to the WhatsApp server."
        );

    }


    let data;

    try {

        data =
            await response.json();

    } catch (error) {

        data = {
            success: false,
            message:
                "Invalid response from WhatsApp server."
        };

    }


    if (!response.ok) {

        throw new Error(
            data?.message ||
            data?.error ||
            `WhatsApp server returned ${response.status}`
        );

    }


    return data;

}


/*
============================================================
GET WHATSAPP STATUS
============================================================
*/

async function getWhatsAppStatus() {

    try {

        const data =
            await whatsappRequest(
                "/whatsapp-status",
                {
                    method: "GET"
                }
            );


        return data;

    } catch (error) {

        console.error(
            "❌ WhatsApp status proxy error:",
            error.message
        );


        return {

            enabled:
                false,

            ready:
                false,

            state:
                "SERVER_OFFLINE",

            qr:
                null,

            hasQR:
                false,

            error:
                error.message

        };

    }

}


/*
============================================================
CHECK WHATSAPP READY
============================================================
*/

async function isWhatsAppReady() {

    try {

        const status =
            await getWhatsAppStatus();

        return Boolean(
            status?.ready
        );

    } catch (error) {

        return false;

    }

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

    const result =
        await whatsappRequest(
            "/send-whatsapp",
            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        phoneNumber,

                        name,

                        temperature,

                        riskLevel,

                        suggestion

                    })

            }
        );


    return result;

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