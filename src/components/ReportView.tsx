import { useState, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Calendar, 
  Filter, 
  ArrowUpDown,
  Car
} from "lucide-react";
import { VehicleRequest } from "../types";

interface ReportViewProps {
  requests: VehicleRequest[];
}

export default function ReportView({ requests }: ReportViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  
  // Sorting state
  const [sortField, setSortField] = useState<"startDate" | "vehicleName" | "pic" | "passengerCount">("startDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Get unique vehicle names for filter dropdown
  const uniqueVehicles = useMemo(() => {
    const list = requests.map(r => r.vehicleName);
    return Array.from(new Set(list));
  }, [requests]);

  // Handle sorting
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // 1. Search term match (activity or pic)
      const matchesSearch = 
        req.activity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.pic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.destination.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Vehicle filter
      const matchesVehicle = selectedVehicle === "all" || req.vehicleName === selectedVehicle;

      // 3. Status filter
      const matchesStatus = selectedStatus === "all" || req.status === selectedStatus;

      // 4. Date range filter
      let matchesDates = true;
      if (startDateStr) {
        matchesDates = matchesDates && req.startDate >= startDateStr;
      }
      if (endDateStr) {
        matchesDates = matchesDates && req.startDate <= endDateStr;
      }

      return matchesSearch && matchesVehicle && matchesStatus && matchesDates;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === "startDate") {
        comparison = a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime);
      } else if (sortField === "vehicleName") {
        comparison = a.vehicleName.localeCompare(b.vehicleName);
      } else if (sortField === "pic") {
        comparison = a.pic.localeCompare(b.pic);
      } else if (sortField === "passengerCount") {
        comparison = a.passengerCount - b.passengerCount;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [requests, searchTerm, selectedVehicle, selectedStatus, startDateStr, endDateStr, sortField, sortDirection]);

  // Color helper based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Disetujui</span>;
      case "rejected":
        return <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Ditolak</span>;
      case "completed":
        return <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Selesai</span>;
      case "pending":
      default:
        return <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-full">Menunggu</span>;
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvHeaders = [
      "Nama Kendaraan",
      "Penanggung Jawab",
      "Kegiatan",
      "Tanggal Penggunaan",
      "Jam Penggunaan",
      "Tujuan Perjalanan",
      "Jumlah Penumpang",
      "Status"
    ];

    const rows = filteredRequests.map(req => [
      req.vehicleName,
      req.pic,
      req.activity,
      `${req.startDate} s/d ${req.endDate}`,
      `${req.startTime} s/d ${req.endTime}`,
      req.destination,
      req.passengerCount,
      req.status === "approved" ? "Disetujui" : req.status === "rejected" ? "Ditolak" : req.status === "completed" ? "Selesai" : "Menunggu Persetujuan"
    ]);

    // Construct CSV with UTF-8 BOM
    const csvContent = "\uFEFF" + [
      csvHeaders.join(";"),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Laporan_Penggunaan_Kendaraan_SCB_GO_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF / Print Pop-Up
  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker menghalangi pencetakan laporan. Silakan izinkan popup untuk situs ini.");
      return;
    }

    const tableRowsHtml = filteredRequests.map((req, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 10px; font-weight: bold; font-size: 11px; color: #1e293b;">${req.vehicleName}</td>
        <td style="padding: 10px; font-size: 11px;">${req.pic}</td>
        <td style="padding: 10px; font-size: 11px;">${req.activity}</td>
        <td style="padding: 10px; font-size: 11px;">${req.startDate} (${req.startTime})<br/>s/d ${req.endDate} (${req.endTime})</td>
        <td style="padding: 10px; font-size: 11px;">${req.destination}</td>
        <td style="padding: 10px; text-align: center; font-size: 11px;">${req.passengerCount}</td>
        <td style="padding: 10px; text-align: center; font-size: 11px; font-weight: bold;">
          ${req.status === "approved" ? "Setuju" : req.status === "rejected" ? "Tolak" : req.status === "completed" ? "Selesai" : "Menunggu"}
        </td>
      </tr>
    `).join("");

    const htmlContent = `
      <html>
        <head>
          <title>Laporan Penggunaan Kendaraan Operasional SCB-GO</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #334155; margin: 40px; }
            .header { border-bottom: 3px double #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between; }
            .logo-placeholder { font-weight: 800; font-size: 24px; color: #1e3a8a; letter-spacing: -0.5px; }
            .title { text-align: right; }
            .title h1 { margin: 0; font-size: 20px; color: #1e3a8a; }
            .title p { margin: 5px 0 0; font-size: 11px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f1f5f9; padding: 12px 10px; text-align: left; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; color: #475569; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
            .signature { border-top: 1px solid #94a3b8; width: 220px; text-align: center; padding-top: 8px; margin-top: 60px; }
            @media print {
              button { display: none; }
              body { margin: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-placeholder">SCB-GO</div>
            <div class="title">
              <h1>LAPORAN PENGGUNAAN KENDARAAN OPERASIONAL</h1>
              <p>Sekolah Cendekia BAZNAS • Tanggal Cetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
            </div>
          </div>
          
          <div style="font-size: 12px; margin-bottom: 20px;">
            <strong>Periode Laporan:</strong> ${startDateStr || "Semua Tanggal"} s/d ${endDateStr || "Semua Tanggal"}<br/>
            <strong>Kendaraan:</strong> ${selectedVehicle === "all" ? "Semua Kendaraan" : selectedVehicle}<br/>
            <strong>Status:</strong> ${selectedStatus === "all" ? "Semua Status" : selectedStatus}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th style="width: 130px;">Kendaraan</th>
                <th style="width: 120px;">Penanggung Jawab</th>
                <th>Kegiatan</th>
                <th style="width: 140px;">Waktu</th>
                <th style="width: 110px;">Tujuan</th>
                <th style="width: 50px; text-align: center;">Pax</th>
                <th style="width: 80px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 30px; color: #94a3b8;">Tidak ada data yang sesuai filter</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <div>SCB-GO (Sekolah Cendekia BAZNAS) • Transparansi & Akuntabilitas Operasional</div>
            <div>
              Halaman 1 dari 1
              <div class="signature">
                Kepala Bagian Operasional SCB
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Filters Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm" id="reports-filter-form">
        <div className="flex items-center gap-3 mb-4" id="report-filter-header border-b border-slate-200 pb-3">
          <div className="w-10 h-10 bg-blue-600/10 text-blue-600 rounded-lg flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Kriteria Pencarian & Filter Laporan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Saring data penggunaan secara transparan dan akuntabel</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Cari Kegiatan / Penanggung Jawab</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pelatihan, BAZNAS, Budi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Vehicle Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Kendaraan</label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="py-2 px-3 text-xs w-full rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
            >
              <option value="all">Semua Kendaraan</option>
              {uniqueVehicles.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Status Pengajuan</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="py-2 px-3 text-xs w-full rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Menunggu Persetujuan</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
              <option value="completed">Selesai</option>
            </select>
          </div>

          {/* Date range filters */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Rentang Tanggal</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="py-2 px-2.5 text-[11px] w-full rounded-xl border border-slate-200 focus:outline-none bg-slate-50/50"
              />
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="py-2 px-2.5 text-[11px] w-full rounded-xl border border-slate-200 focus:outline-none bg-slate-50/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons & Total Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-1 px-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm">
            {filteredRequests.length}
          </div>
          <p className="text-slate-500 text-xs font-semibold">Pengajuan ditemukan berdasarkan kriteria filter</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredRequests.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          
          <button
            onClick={handlePrintPDF}
            disabled={filteredRequests.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-slate-750 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Cetak PDF
          </button>
        </div>
      </div>

      {/* Grid Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="report-table-wrapper">
        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-slate-700 text-xs text-left" id="report-table">
            <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-4 px-5">No</th>
                <th className="py-4 px-4 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort("vehicleName")}>
                  <div className="flex items-center gap-1">
                    Kendaraan <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-4 px-4 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort("pic")}>
                  <div className="flex items-center gap-1">
                    Penanggung Jawab <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-4 px-4">Kegiatan</th>
                <th className="py-4 px-4 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort("startDate")}>
                  <div className="flex items-center gap-1">
                    Tanggal Penggunaan <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-4 px-4">Tujuan</th>
                <th className="py-4 px-4 text-center cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort("passengerCount")}>
                  <div className="flex items-center gap-1 justify-center">
                    Pax <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-4 px-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm font-medium italic">
                    <Car className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
                    Belum ada data pengajuan kendaraan operasional yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req, idx) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-all duration-150">
                    <td className="py-4 px-5 font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-4 px-4 font-bold text-slate-800">{req.vehicleName}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700">{req.pic}</td>
                    <td className="py-4 px-4 max-w-[200px] truncate" title={req.activity}>{req.activity}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span>{req.startDate}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 ml-5 block mt-0.5">{req.startTime} - {req.endTime}</span>
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-600">{req.destination}</td>
                    <td className="py-4 px-4 text-center font-bold text-slate-800">{req.passengerCount}</td>
                    <td className="py-4 px-5 text-center">{getStatusBadge(req.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
