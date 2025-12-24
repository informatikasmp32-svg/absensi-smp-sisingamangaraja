// 1. PENGATURAN DATABASE (Arahkan ke Root agar bisa akses absensi dan master_siswa)
const dbRootURL = "https://absen-sisingamangaraja-default-rtdb.asia-southeast1.firebasedatabase.app/";

// 2. FUNGSI AMBIL DATA MASTER SISWA (ONLINE)
async function getStudents() {
    try {
        const res = await fetch(`${dbRootURL}master_siswa.json`);
        const data = await res.json();
        // Firebase menyimpan sebagai object, kita ubah ke array
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

// Pengaturan jam tetap lokal (sesuai konfigurasi admin di browser tersebut)
const getConfig = () => JSON.parse(localStorage.getItem('absensi_config') || '{"jamMasuk":"07:30"}');

// 4. FUNGSI SIMPAN ABSENSI (ONLINE)
async function saveAttendanceAuto(id) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const today = now.toLocaleDateString('id-ID');
    
    const session = (now.getHours() < 12) ? "Masuk" : "Pulang";
    
    // Ambil data siswa dari cloud (Async)
    const students = await getStudents();
    const student = students.find(s => s.id === id);
    
    if (!student) return { success: false, message: "TIDAK TERDAFTAR", studentData: {id, name: "Unknown", kelas: "-"} };

    // Cek duplikasi di cloud
    const logs = await getLogs();
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
    
    try {
        // Simpan ke Firebase
        await fetch(`${dbRootURL}absensi.json`, {
            method: 'POST',
            body: JSON.stringify(entry)
        });

        // Fitur Notifikasi WA
        if (student.wa && student.wa !== "-") {
            sendNotificationWA(student.name, status, student.wa);
        }
        
        return { success: true, mode: status, studentData: student };
    } catch (e) {
        return { success: false, message: "KONEKSI INTERNET BERMASALAH" };
    }
}

// 5. FUNGSI EXPORT & TEMPLATE
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

// 6. FUNGSI NOTIFIKASI WA (LOGIKA URL)
function sendNotificationWA(name, status, phone) {
    const msg = encodeURIComponent(`Info Absensi SMP Sisingamangaraja\nNama: *${name}*\nStatus: *${status}*`);
    const url = `https://wa.me/${phone}?text=${msg}`;
    console.log("Kirim WA ke: " + phone);
    // window.open(url, '_blank'); // Aktifkan jika ingin otomatis buka tab WA
}
