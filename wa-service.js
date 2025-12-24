const WA_CONFIG = {
    // Token dari gambar "Edit Device" Anda
    token: "6htysfxRrJnuquU2IEJf", 
    baseUrl: "https://api.fonnte.com/send",
    countryCode: "62"
};

async function sendNotificationWA(studentName, status, parentNumber) {
    let target = String(parentNumber).replace(/[^\d]/g, "");
    if (target.startsWith("08")) target = "62" + target.substring(1);
    if (target.length < 10) return;

    const message = `*ABSENSI SMP SISINGAMANGARAJA*\n\n` +
                    `Ananda: *${studentName}*\n` +
                    `Status: *${status.toUpperCase()}*\n` +
                    `Jam: ${new Date().toLocaleTimeString('id-ID')} WIB`;

    try {
        const response = await fetch(WA_CONFIG.baseUrl, {
            method: 'POST',
            headers: { 'Authorization': WA_CONFIG.token },
            body: new URLSearchParams({
                'target': target,
                'message': message,
                'delay': '2'
            })
        });

        const result = await response.json();
        console.log("Status Kirim:", result);
        
        if (!result.status) {
            alert("Fonnte Error: " + result.reason);
        }
    } catch (error) {
        console.error("Koneksi Internet Bermasalah:", error);
    }
}