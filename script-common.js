// 1. PENGATURAN DATABASE
const dbRootURL = "https://absen-sisingamangaraja-default-rtdb.asia-southeast1.firebasedatabase.app/";

// 2. FUNGSI AMBIL DATA MASTER SISWA (ONLINE)
async function getStudents() {
    try {
        const res = await fetch(`${dbRootURL}master_siswa.json`);
        const data = await res.json();
        return data ? Object.values(data) : [];
    } catch (e) {
        console.error("Gagal ambil data siswa online:", e);
        return [];
    }
}

// 3. FUNGSI AMBIL DATA LOG ABSENSI (ONLINE)
async function getLogs() {
    try {
        const res = await fetch(`${dbRootURL}absensi.json`);
        const data = await res.json();
        return data ? Object.values(data) : [];
    } catch (e) {
        console.error("Gagal ambil log online:", e);
        return [];
    }
}

// Pengaturan jam tetap lokal
const getConfig = () => JSON.parse(localStorage.getItem('absensi_config') || '{"jamMasuk":"07:30"}');

// 4. FUNGSI IMPORT EXCEL (TAMBAHKAN INI AGAR TIDAK ERROR)
async function importX(el) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            const formatted = json.map(r => ({
                id: String(r.ID || r.id || r.NIS || ""),
                name: String(r.Nama || r.nama || ""),
                kelas: String(r.Kelas || r.kelas || "-"),
                wa: String(r.WA || "62")
            })).filter(item => item.id !== "");

            // Simpan ke Firebase folder master_siswa
            await fetch(`${dbRootURL}master_siswa.json`, {
                method: 'PUT',
                body: JSON.stringify(formatted)
            });

            alert(`Berhasil upload ${formatted.length} data siswa ke Cloud!`);
            location.reload(); 
        } catch (error) {
            console.error("Gagal Import:", error);
            alert("Terjadi kesalahan saat mengunggah data.");
        }
    };
    reader.readAsArrayBuffer(el.files[0]);
}
// Tambahkan fungsi ini ke dalam script-common.js
async function importX(el) {
    if (!el.files[0]) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            // Format data sesuai struktur Firebase Anda
            const formatted = json.map(r => ({
                id: String(r.ID || r.id || r.NIS || ""),
                name: String(r.Nama || r.nama || ""),
                kelas: String(r.Kelas || r.kelas || "-"),
                wa: String(r.WA || "")
            })).filter(item => item.id !== "");

            // Simpan ke Firebase (Ganti URL dengan URL database Anda)
            const dbURL = "https://absen-sisingamangaraja-default-rtdb.asia-southeast1.firebasedatabase.app/master_siswa.json";
            await fetch(dbURL, {
                method: 'PUT',
                body: JSON.stringify(formatted)
            });

            alert(`Berhasil mengimpor ${formatted.length} siswa!`);
            location.reload();
        } catch (error) {
            alert("Gagal membaca file Excel. Pastikan format benar.");
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(el.files[0]);
}
// 5. FUNGSI SIMPAN ABSENSI (ONLINE)
function saveAttendanceAuto(id) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const today = now.toLocaleDateString('id-ID');
    
    const session = (now.getHours() < 12) ? "Masuk" : "Pulang";
    const students = getStudents();
    const student = students.find(s => s.id === id);
    
    if (!student) return { success: false, message: "TIDAK TERDAFTAR", studentData: {id, name: "Unknown", kelas: "-"} };

    let logs = getLogs();
    const isDuplicate = logs.find(l => l.id === id && l.type === session && new Date(l.timestamp).toLocaleDateString('id-ID') === today);

    if (isDuplicate) return { success: false, message: `SUDAH ABSEN ${session.toUpperCase()}`, studentData: student };

    let status = (session === "Masuk") ? (timeStr > getConfig().jamMasuk ? "Terlambat" : "Tepat Waktu") : "Pulang";

    const entry = { 
        id, 
        name: student.name, 
        kelas: student.kelas, 
        mode: status, 
        type: session, 
        timestamp: now.toISOString() 
    };
    
    logs.push(entry);
    localStorage.setItem('absensi_logs', JSON.stringify(logs));

    // --- INTEGRASI WA DI SINI ---
    // Pastikan data siswa memiliki properti 'wa' dari Excel
    if (student.wa) {
        sendNotificationWA(student.name, status, student.wa);
    }

    return { success: true, mode: status, studentData: student };
}

// 6. FUNGSI EXPORT & TEMPLATE
async function exportToExcel() {
    const data = await getLogs();
    if(data.length === 0) return alert("Data Kosong");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, "Laporan_Absensi_Online.xlsx");
}

function downloadTemplateExcel() {
    const data = [{ ID: "1001", Nama: "Ahmad Fauzi", Kelas: "7-A", WA: "628123456789" }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
}

// 7. FUNGSI NOTIFIKASI WA
function sendNotificationWA(name, status, phone) {
    const msg = encodeURIComponent(`Info Absensi SMP Sisingamangaraja\nNama: *${name}*\nStatus: *${status}*`);
    const url = `https://wa.me/${phone}?text=${msg}`;
    console.log("Kirim WA ke: " + phone);
}
function kirimWA(nama, status, jam, nomorWA) {
    if (!nomorWA || nomorWA === '-') return;

    // Pastikan nomor mulai dengan 62
    let phone = nomorWA.replace(/[^\d]/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);

    const pesan = `Info Absensi SMP Sisingamangaraja%0A%0ANama: *${nama}*%0AStatus: *${status}*%0AJam: ${jam}%0A%0A_Pesan ini dikirim otomatis oleh sistem._`;
    
    // Membuka tab baru untuk WhatsApp
    window.open(`https://wa.me/${phone}?text=${pesan}`, '_blank');
}


