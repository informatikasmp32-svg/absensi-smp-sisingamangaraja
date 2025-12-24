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
        if (!data) return [];
        return Object.keys(data).map(key => ({
            ...data[key],
            firebaseKey: key 
        }));
    } catch (e) {
        console.error("Gagal ambil log online:", e);
        return [];
    }
}

// Pengaturan jam tetap lokal
const getConfig = () => JSON.parse(localStorage.getItem('absensi_config') || '{"jamMasuk":"07:30"}');

// 4. FUNGSI LOGIKA WAKTU & SIMPAN CLOUD (TELAH DIPERBAIKI)
async function saveAttendanceAuto(siswa, statusManual = null) {
    const now = new Date();
    const jamAngka = now.getHours();
    const jamMenit = now.toLocaleTimeString('id-ID', {hour12:false, hour:'2-digit', minute:'2-digit'});
    const hariIni = now.toLocaleDateString('id-ID');
    
    // Tentukan Sesi berdasarkan jam 12:00
    const session = (jamAngka < 12) ? "Masuk" : "Pulang";
    
    // Cek duplikasi di Cloud agar tidak double scan di hari/sesi yang sama
    const logs = await getLogs();
    const isDuplicate = logs.find(l => 
        l.id === siswa.id && 
        l.type === session && 
        new Date(l.timestamp).toLocaleDateString('id-ID') === hariIni
    );

    if (isDuplicate) {
        return { success: false, message: `SUDAH ABSEN ${session.toUpperCase()}` };
    }

    // Penentuan Status
    let status = statusManual;
    if (!status) {
        if (jamAngka >= 12) {
            status = "PULANG";
        } else {
            status = (jamMenit <= getConfig().jamMasuk) ? "TEPAT WAKTU" : "TERLAMBAT";
        }
    }

    const entry = { 
        id: siswa.id, 
        name: siswa.name, 
        kelas: siswa.kelas, 
        mode: status, 
        type: session, 
        timestamp: now.toISOString(),
        waParent: siswa.wa || ""
    };

    try {
        // SIMPAN KE FIREBASE
        await fetch(`${dbRootURL}absensi.json`, {
            method: 'POST',
            body: JSON.stringify(entry)
        });

        // KIRIM WHATSAPP
        if (siswa.wa && siswa.wa !== "" && siswa.wa !== "-") {
            kirimWA(siswa.name, status, jamMenit, siswa.wa);
        }

        return { success: true, mode: status };
    } catch (e) {
        console.error("Gagal simpan ke Cloud:", e);
        return { success: false, message: "GAGAL KONEKSI CLOUD" };
    }
}

// 5. FUNGSI KIRIM WHATSAPP
function kirimWA(nama, status, jam, nomorWA) {
    if (!nomorWA || nomorWA === "" || nomorWA === "-") return;

    let phone = nomorWA.replace(/[^\d]/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);

    let pesanHeader = "*ABSENSI DIGITAL SMP SISINGAMANGARAJA*";
    let isiPesan = (status === "PULANG") 
        ? `Halo Bapak/Ibu, Ananda *${nama}* telah melakukan scan *PULANG* pada jam ${jam}.`
        : `Ananda: *${nama}*%0AStatus: *${status}*%0AJam: ${jam}`;

    const pesanFinal = `${pesanHeader}%0A%0A${isiPesan}%0A%0A_Pesan otomatis sistem._`;
    window.open(`https://wa.me/${phone}?text=${pesanFinal}`, '_blank');
}

// 6. FUNGSI EXPORT & TEMPLATE
async function exportToExcel() {
    const data = await getLogs();
    if(data.length === 0) return alert("Data Kosong");
    
    const dataRapi = data.map(l => ({
        Waktu: new Date(l.timestamp).toLocaleString('id-ID'),
        ID: l.id,
        Nama: l.name,
        Kelas: l.kelas,
        Status: l.mode
    }));

    const ws = XLSX.utils.json_to_sheet(dataRapi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, "Laporan_Absensi_Sisingamangaraja.xlsx");
}

function downloadTemplateExcel() {
    const data = [{ ID: "1001", Nama: "Ahmad Fauzi", Kelas: "7-A", WA: "628123456789" }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
}

// 7. FUNGSI HAPUS LOG (ADMIN)
async function delL(timestamp) {
    if(!confirm("Hapus baris absensi ini?")) return;
    const allLogs = await getLogs();
    const item = allLogs.find(l => l.timestamp === timestamp);
    if(item && item.firebaseKey) {
        await fetch(`${dbRootURL}absensi/${item.firebaseKey}.json`, { method: 'DELETE' });
        location.reload();
    }
}
