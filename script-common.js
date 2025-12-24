// 1. PENGATURAN DATABASE (Dapatkan URL ini dari Firebase Console)
const dbURL = "https://absen-sisingamangaraja-default-rtdb.asia-southeast1.firebasedatabase.app/absensi.json";

// 2. FUNGSI AMBIL DATA (ONLINE)
async function getLogs() {
    try {
        const response = await fetch(dbURL);
        const data = await response.json();
        // Firebase menyimpan data dalam bentuk objek, kita ubah ke Array
        return data ? Object.values(data) : [];
    } catch (e) {
        console.error("Gagal mengambil data online:", e);
        return []; 
    }
}

const getStudents = () => JSON.parse(localStorage.getItem('master_siswa') || '[]');
const getConfig = () => JSON.parse(localStorage.getItem('absensi_config') || '{"jamMasuk":"07:50"}');

// 3. FUNGSI SIMPAN ABSENSI (ONLINE)
async function saveAttendanceAuto(id) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const today = now.toLocaleDateString('id-ID');
    
    const session = (now.getHours() < 12) ? "Masuk" : "Pulang";
    const students = getStudents();
    const student = students.find(s => s.id === id);
    
    if (!student) return { success: false, message: "TIDAK TERDAFTAR", studentData: {id, name: "Unknown", kelas: "-"} };

    // Ambil logs terbaru untuk cek duplikasi
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
        await fetch(dbURL, {
            method: 'POST',
            body: JSON.stringify(entry)
        });

        if (student.wa && student.wa !== "-") {
            sendNotificationWA(student.name, status, student.wa);
        }
        return { success: true, mode: status, studentData: student };
    } catch (e) {
        return { success: false, message: "KONEKSI INTERNET BERMASALAH" };
    }
}

// 4. FUNGSI EXPORT EXCEL
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

function sendNotificationWA(name, status, phone) {
    const msg = encodeURIComponent(`Info Absensi SMP Sisingamangaraja\nNama: *${name}*\nStatus: *${status}*`);
    const url = `https://wa.me/${phone}?text=${msg}`;
    console.log("Kirim WA ke: " + phone);

}

