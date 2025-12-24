// 1. PENGATURAN DATABASE ONLINE
const dbRootURL = "https://absen-sisingamangaraja-default-rtdb.asia-southeast1.firebasedatabase.app/";

// 2. AMBIL DATA MASTER SISWA DARI CLOUD
async function getStudents() {
    try {
        const res = await fetch(`${dbRootURL}master_siswa.json`);
        const data = await res.json();
        return data ? Object.values(data) : [];
    } catch (e) {
        console.error("Gagal ambil data siswa:", e);
        return [];
    }
}

// 3. AMBIL LOG ABSENSI DARI CLOUD
async function getLogs() {
    try {
        const res = await fetch(`${dbRootURL}absensi.json`);
        const data = await res.json();
        if (!data) return [];
        // Mengubah objek Firebase menjadi Array agar bisa dibaca tabel
        return Object.keys(data).map(key => ({
            ...data[key],
            firebaseKey: key 
        }));
    } catch (e) {
        console.error("Gagal ambil log:", e);
        return [];
    }
}

// 4. KONFIGURASI JAM (LOKAL)
const getConfig = () => JSON.parse(localStorage.getItem('absensi_config') || '{"jamMasuk":"07:30"}');

// 5. FUNGSI SIMPAN OTOMATIS KE CLOUD (PERBAIKAN UTAMA)
async function saveAttendanceAuto(siswa) {
    const now = new Date();
    const jamAngka = now.getHours();
    const jamMenitStr = now.toLocaleTimeString('id-ID', {hour12:false, hour:'2-digit', minute:'2-digit'});
    const tglIndo = now.toLocaleDateString('id-ID');
    
    // Tentukan Sesi (Pagi/Masuk vs Sore/Pulang)
    const session = (jamAngka < 12) ? "Masuk" : "Pulang";
    
    // Cek Duplikasi: Jangan sampai siswa scan dua kali di sesi yang sama
    const logs = await getLogs();
    const isDuplicate = logs.find(l => 
        l.id === siswa.id && 
        l.type === session && 
        new Date(l.timestamp).toLocaleDateString('id-ID') === tglIndo
    );

    if (isDuplicate) return { success: false, message: `SUDAH ABSEN ${session.toUpperCase()}` };

    // Logika Status: Jika jam 12 keatas langsung PULANG
    let status = "";
    if (jamAngka >= 12) {
        status = "PULANG";
    } else {
        status = (jamMenitStr <= getConfig().jamMasuk) ? "TEPAT WAKTU" : "TERLAMBAT";
    }

    const entry = { 
        id: siswa.id, 
        name: siswa.name, 
        kelas: siswa.kelas, 
        mode: status, 
        type: session, 
        timestamp: now.toISOString()
    };

    try {
        // KIRIM KE FIREBASE (Metode POST agar data bertambah)
        await fetch(`${dbRootURL}absensi.json`, {
            method: 'POST',
            body: JSON.stringify(entry)
        });

        // Jalankan Notifikasi WhatsApp jika ada nomor WA
        if (siswa.wa && siswa.wa !== "" && siswa.wa !== "-") {
            kirimWA(siswa.name, status, jamMenitStr, siswa.wa);
        }

        return { success: true, mode: status };
    } catch (e) {
        console.error("Koneksi Error:", e);
        return { success: false, message: "GAGAL TERHUBUNG KE CLOUD" };
    }
}

// 6. FUNGSI KIRIM WHATSAPP
function kirimWA(nama, status, jam, nomorWA) {
    let phone = nomorWA.replace(/[^\d]/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);

    let pesanHeader = "*ABSENSI DIGITAL SMP SISINGAMANGARAJA*";
    let isiPesan = (status === "PULANG") 
        ? `Bapak/Ibu, Ananda *${nama}* telah scan *PULANG* jam ${jam}.`
        : `Ananda: *${nama}*%0AStatus: *${status}*%0AJam: ${jam}`;

    window.open(`https://wa.me/${phone}?text=${pesanHeader}%0A%0A${isiPesan}`, '_blank');
}

// 7. FUNGSI HAPUS LOG (ADMIN)
async function delL(timestamp) {
    if(!confirm("Hapus data ini?")) return;
    const allLogs = await getLogs();
    const item = allLogs.find(l => l.timestamp === timestamp);
    if(item && item.firebaseKey) {
        await fetch(`${dbRootURL}absensi/${item.firebaseKey}.json`, { method: 'DELETE' });
        location.reload();
    }
}
