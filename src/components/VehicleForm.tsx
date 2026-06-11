import { useState, useEffect, FormEvent } from "react";
import { 
  Plus, 
  Trash2, 
  Check, 
  Car, 
  Navigation, 
  Hash, 
  Users, 
  Radio, 
  FileText,
  AlertTriangle
} from "lucide-react";
import { Vehicle, VehicleStatus } from "../types";

interface VehicleFormProps {
  vehicleToEdit?: Vehicle | null;
  onSave: (vehicle: Partial<Vehicle>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCancel: () => void;
}

export default function VehicleForm({ vehicleToEdit, onSave, onDelete, onCancel }: VehicleFormProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [plateNo, setPlateNo] = useState("");
  const [capacity, setCapacity] = useState<number>(5);
  const [status, setStatus] = useState<VehicleStatus>("active");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Hydrate fields if editing
  useEffect(() => {
    if (vehicleToEdit) {
      setName(vehicleToEdit.name);
      setType(vehicleToEdit.type);
      setPlateNo(vehicleToEdit.plateNo);
      setCapacity(vehicleToEdit.capacity);
      setStatus(vehicleToEdit.status);
      setDescription(vehicleToEdit.description || "");
    } else {
      setName("");
      setType("");
      setPlateNo("");
      setCapacity(5);
      setStatus("active");
      setDescription("");
    }
  }, [vehicleToEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) return setErrorMsg("Nama kendaraan wajib diisi.");
    if (!type.trim()) return setErrorMsg("Jenis kendaraan wajib diisi.");
    if (!plateNo.trim()) return setErrorMsg("Nomor polisi wajib diisi.");
    if (capacity <= 0) return setErrorMsg("Kapasitas penumpang harus di atas 0.");

    setLoading(true);

    try {
      const payload: Partial<Vehicle> = {
        name: name.trim(),
        type: type.trim(),
        plateNo: plateNo.trim().toUpperCase(),
        capacity,
        status,
        description: description.trim()
      };

      await onSave(payload);
    } catch (err) {
      console.error("Gagal menyimpan data kendaraan: ", err);
      setErrorMsg("Gagal menyimpan data kendaraan: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!vehicleToEdit || !onDelete) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kendaraan ${vehicleToEdit.name}?`)) return;

    setLoading(true);
    try {
      await onDelete(vehicleToEdit.id);
    } catch (err) {
      console.error("Gagal menghapus kendaraan: ", err);
      setErrorMsg("Gagal menghapus kendaraan: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-lg w-full shrink-0">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wider">
          <Car className="w-5 h-5 text-blue-600" />
          {vehicleToEdit ? "Ubah Data Kendaraan" : "Tambah Kendaraan Baru"}
        </h3>
        {vehicleToEdit && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-1.5 p-1.5 px-3 rounded-lg border border-rose-100 text-rose-600 text-xs font-bold hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Hapus
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold mb-6">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name input */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Kendaraan</label>
          <div className="relative">
            <Car className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Toyota Hiace, Isuzu Elf, dsb."
              className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
              required
            />
          </div>
        </div>

        {/* Type & Plate rows */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Jenis Kendaraan</label>
            <div className="relative">
              <Navigation className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Microbus / Minibus / SUV"
                className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Nomor Polisi</label>
            <div className="relative">
              <Hash className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                value={plateNo}
                onChange={(e) => setPlateNo(e.target.value)}
                placeholder="F 1234 SCB"
                className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
                required
              />
            </div>
          </div>
        </div>

        {/* Capacity & Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Kapasitas Maksimal</label>
            <div className="relative">
              <Users className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="number"
                min="1"
                max="100"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Status Kendaraan</label>
            <div className="relative">
              <Radio className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="active">Aktif (Tersedia)</option>
                <option value="repair">Dalam Perbaikan</option>
                <option value="unavailable">Tidak Tersedia</option>
              </select>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Keterangan / Deskripsi</label>
          <div className="relative">
            <FileText className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keadaan fasilitas AC, ban baru, dsb."
              className="pl-10 pr-3 py-2 text-xs w-full rounded-xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700"
            />
          </div>
        </div>

        {/* Submit & Cancel triggers */}
        <div className="flex justify-end gap-3 pt-4 border-t border-blue-50">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-750 shadow-sm transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </form>
    </div>
  );
}
