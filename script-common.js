// 1. PENGATURAN DATABASE
const dbRootURL = "https://absen-sisingamangaraja-default-rtdb.asia-southeast1.firebasedatabase.app/";

// 2. FUNGSI AMBIL DATA MASTER SISWA (ONLINE)
async function getStudents() {
    try {
        const res = await fetch(`${dbRootURL}master_siswa.json`);
        const data = await res.json();
        // Firebase mengembalikan objek, kita ubah ke array
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
        // Mengubah objek Firebase ke array dan memastikan ada timestamp
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

// 4. FUNGSI IMPORT EXCEL KE FIREBASE
async function importX(el) {
    if (!el.files[0]) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            const formatted = json.map(r => ({
                id: String(r.ID || r.id || r.NIS || ""),
                name: String(r.Nama || r.nama || ""),
                kelas: String(r.Kelas || r.kelas || "-"),
                wa: String(r.WA || r.WhatsApp || "").replace(/[^\d]/g, "")
            })).filter(item => item.id !== "");

            // Simpan ke Firebase dengan metode PUT (Menimpa data lama)
            await fetch(`${dbRootURL}master_siswa.json`, {
                method: 'PUT',
                body: JSON.stringify(formatted)
            });

            alert(`Berhasil mengimpor ${formatted.length} siswa ke Cloud!`);
            location.reload();
        } catch (error) {
            alert("Gagal membaca file Excel. Pastikan format benar.");
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(el.files[0]);
}

// 5. FUNGSI SIMPAN ABSENSI (LOGIKA 3 STATUS: TEPAT, TERLAMBAT, PULANG)
async function saveAttendanceAuto(siswa, statusManual = null) {
    const sekarang = new Date();
    // Format jam ke HH:mm (contoh: 07:45 atau 13:10)
    const jamMenit = sekarang.toLocaleTimeString('id-ID', {hour12:false, hour:'2-digit', minute:'2-digit'});
    const jamAngka = sekarang.getHours();
    
    let status = statusManual;
    
    if (!status) {
        // LOGIKA UTAMA: Jika sudah jam 12 ke atas, langsung dianggap PULANG
        if (jamAngka >= 12) {
            status = "PULANG";
        } 
        // Jika masih pagi (sebelum jam 12), cek keterlambatan
        else if (jamMenit <= getConfig().jamMasuk) {
            status = "TEPAT WAKTU";
        } 
        else {
            status = "TERLAMBAT";
        }
    }

    const logData = {
        id: siswa.id,
        name: siswa.name,
        kelas: siswa.kelas,
        mode: status,
        timestamp: sekarang.toISOString(),
        waParent: siswa.wa || ""
    };

    // ... (proses simpan ke Firebase dan kirim WA tetap sama)
}

    try {
        // Simpan ke Firebase (POST agar menambah data baru)
        await fetch(`${dbRootURL}absensi.json`, {
            method: 'POST',
            body: JSON.stringify(logData)
        });

        // Pemicu Kirim WhatsApp
        kirimWA(siswa.name, status, jamMenit, siswa.wa);

        return { success: true, mode: status };
    } catch (error) {
        console.error("Gagal simpan absensi ke Cloud:", error);
        return { success: false };
    }
}

// 6. FUNGSI KIRIM WHATSAPP
function kirimWA(nama, status, jam, nomorWA) {
    if (!nomorWA || nomorWA === "" || nomorWA === "-") {
        console.log("Nomor WA tidak tersedia.");
        return;
    }

    // Format nomor ke internasional
    let phone = nomorWA.replace(/[^\d]/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);

    let pesanHeader = "*ABSENSI DIGITAL SMP SISINGAMANGARAJA*";
    let isiPesan = "";

    if (status === "PULANG") {
        isiPesan = `Halo Bapak/Ibu, Ananda *${nama}* telah melakukan scan *PULANG* pada jam ${jam}.`;
    } else {
        isiPesan = `Ananda: *${nama}*%0AStatus: *${status}*%0AJam: ${jam}`;
    }

    const pesanFinal = `${pesanHeader}%0A%0A${isiPesan}%0A%0A_Pesan otomatis sistem._`;
    
    // Eksekusi buka WhatsApp
    window.open(`https://wa.me/${phone}?text=${pesanFinal}`, '_blank');
}

// 7. FUNGSI EXPORT & TEMPLATE
async function exportToExcel() {
    const data = await getLogs();
    if(data.length === 0) return alert("Data Kosong");
    
    // Rapikan data untuk Excel
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
    const data = [{ ID: "1001", Nama: "Ahmad Fauzi", Kelas: "7-A", WA: "08123456789" }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
}

// Fungsi Hapus Log (Admin)
async function delL(timestamp) {
    if(!confirm("Hapus baris absensi ini?")) return;
    const allLogs = await getLogs();
    const item = allLogs.find(l => l.timestamp === timestamp);
    if(item && item.firebaseKey) {
        await fetch(`${dbRootURL}absensi/${item.firebaseKey}.json`, { method: 'DELETE' });
        location.reload();
    }
}

