import React, { useEffect, useMemo, useState } from 'react';
import Button from './Button';
import { ClientServiceRecord, ClientServiceRecordFormData } from '../types';
import { supabase } from '../lib/supabase';

interface AdminManagementPageProps {
  onLogout?: () => void;
}

type SortableField = keyof ClientServiceRecordFormData;
type SortDirection = 'asc' | 'desc';
const PAGE_SIZE = 8;

const INITIAL_FORM: ClientServiceRecordFormData = {
  cliente: '',
  telefono: '',
  vehiculo: '',
  modelo: '',
  anio: new Date().getFullYear(),
  placas: '',
  km: 0,
  servicioRealizado: '',
  fechaServicio: '',
  proximoServicioKm: 0,
  proximaFecha: '',
};

type ServiceRecordRow = {
  id: string;
  cliente: string;
  telefono: string;
  vehiculo: string;
  modelo: string;
  anio: number;
  placas: string;
  km: number;
  servicio_realizado: string;
  fecha_servicio: string;
  proximo_servicio_km: number;
  proxima_fecha: string;
};

const TABLE_COLUMNS: Array<{ key: SortableField; label: string }> = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'vehiculo', label: 'Vehículo' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'anio', label: 'Año' },
  { key: 'placas', label: 'Placas' },
  { key: 'km', label: 'Km' },
  { key: 'servicioRealizado', label: 'Servicio realizado' },
  { key: 'fechaServicio', label: 'Fecha de servicio' },
  { key: 'proximoServicioKm', label: 'Próximo servicio (km/millas)' },
  { key: 'proximaFecha', label: 'Próxima fecha' },
];

const toFormData = (record: ClientServiceRecord): ClientServiceRecordFormData => ({
  cliente: record.cliente,
  telefono: record.telefono,
  vehiculo: record.vehiculo,
  modelo: record.modelo,
  anio: record.anio,
  placas: record.placas,
  km: record.km,
  servicioRealizado: record.servicioRealizado,
  fechaServicio: record.fechaServicio,
  proximoServicioKm: record.proximoServicioKm,
  proximaFecha: record.proximaFecha,
});

const mapRowToRecord = (row: ServiceRecordRow): ClientServiceRecord => ({
  id: row.id,
  cliente: row.cliente,
  telefono: row.telefono,
  vehiculo: row.vehiculo,
  modelo: row.modelo,
  anio: row.anio,
  placas: row.placas,
  km: row.km,
  servicioRealizado: row.servicio_realizado,
  fechaServicio: row.fecha_servicio,
  proximoServicioKm: row.proximo_servicio_km,
  proximaFecha: row.proxima_fecha,
});

const mapFormToRow = (data: ClientServiceRecordFormData) => ({
  cliente: data.cliente,
  telefono: data.telefono,
  vehiculo: data.vehiculo,
  modelo: data.modelo,
  anio: data.anio,
  placas: data.placas,
  km: data.km,
  servicio_realizado: data.servicioRealizado,
  fecha_servicio: data.fechaServicio,
  proximo_servicio_km: data.proximoServicioKm,
  proxima_fecha: data.proximaFecha,
});

const toCsvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

const getSortValue = (record: ClientServiceRecord, field: SortableField): string | number => {
  if (field === 'fechaServicio' || field === 'proximaFecha') {
    return new Date(record[field]).getTime();
  }
  return record[field];
};

const isNextDateNear = (nextDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limitDate = new Date(today);
  limitDate.setDate(limitDate.getDate() + 14);

  const target = new Date(nextDate);
  return target >= today && target <= limitDate;
};

const formatDate = (date: string) => {
  if (!date) {
    return '-';
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString('es-MX');
};

const AdminManagementPage: React.FC<AdminManagementPageProps> = ({ onLogout }) => {
  const [records, setRecords] = useState<ClientServiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortableField>('cliente');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientServiceRecord | null>(null);
  const [formData, setFormData] = useState<ClientServiceRecordFormData>(INITIAL_FORM);

  useEffect(() => {
    const loadRecords = async () => {
      setIsLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('client_service_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMessage('No se pudieron cargar los registros. Verifica la tabla/políticas en Supabase.');
        setIsLoading(false);
        return;
      }

      const mapped = (data as ServiceRecordRow[]).map(mapRowToRecord);
      setRecords(mapped);
      setIsLoading(false);
    };

    void loadRecords();
  }, []);

  const filteredAndSortedRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = normalizedSearch
      ? records.filter((record) =>
          [record.cliente, record.telefono, record.placas, record.vehiculo, record.modelo]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        )
      : records;

    return [...filtered].sort((first, second) => {
      const firstValue = getSortValue(first, sortField);
      const secondValue = getSortValue(second, sortField);

      if (firstValue === secondValue) {
        return 0;
      }

      const comparison = firstValue > secondValue ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [records, searchTerm, sortField, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredAndSortedRecords.length / PAGE_SIZE));

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSortedRecords.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedRecords, currentPage]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setEditingId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (record: ClientServiceRecord) => {
    setFormData(toFormData(record));
    setEditingId(record.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSort = (field: SortableField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const openDeleteModal = (record: ClientServiceRecord) => {
    setDeleteTarget(record);
  };

  const closeDeleteModal = () => {
    if (isSaving) {
      return;
    }

    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const { error } = await supabase.from('client_service_records').delete().eq('id', deleteTarget.id);

    if (error) {
      setErrorMessage('No se pudo eliminar el registro.');
      setIsSaving(false);
      return;
    }

    setRecords((previous) => previous.filter((record) => record.id !== deleteTarget.id));
    setDeleteTarget(null);
    setIsSaving(false);
  };

  const parseNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    if (editingId) {
      const payload = mapFormToRow(formData);
      const { data, error } = await supabase
        .from('client_service_records')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();

      if (error) {
        setErrorMessage('No se pudo actualizar el registro.');
        setIsSaving(false);
        return;
      }

      setRecords((previous) =>
        previous.map((record) => (record.id === editingId ? mapRowToRecord(data as ServiceRecordRow) : record))
      );
      setIsSaving(false);
      closeModal();
      return;
    }

    const payload = mapFormToRow(formData);
    const { data, error } = await supabase
      .from('client_service_records')
      .insert(payload)
      .select()
      .single();

    if (error) {
      setErrorMessage('No se pudo crear el registro.');
      setIsSaving(false);
      return;
    }

    setRecords((previous) => [mapRowToRecord(data as ServiceRecordRow), ...previous]);
    setIsSaving(false);
    closeModal();
  };

  const exportCsv = () => {
    const headers = TABLE_COLUMNS.map((column) => toCsvValue(column.label)).join(',');
    const rows = filteredAndSortedRecords.map((record) =>
      [
        record.cliente,
        record.telefono,
        record.vehiculo,
        record.modelo,
        record.anio,
        record.placas,
        record.km,
        record.servicioRealizado,
        record.fechaServicio,
        record.proximoServicioKm,
        record.proximaFecha,
      ]
        .map(toCsvValue)
        .join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogo-servicios-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Administración de Clientes</h1>
              <p className="mt-1 text-sm text-gray-600">
                Catálogo de historial de servicios de vehículos
              </p>
              {errorMessage && <p className="mt-2 text-sm text-red-700">{errorMessage}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => (window.location.href = '/')}>
                Volver al sitio
              </Button>
              {onLogout && (
                <Button variant="outline" className="text-red-700 hover:bg-red-50" onClick={onLogout}>
                  Cerrar sesión
                </Button>
              )}
              <Button variant="outline" onClick={exportCsv} disabled={isLoading || records.length === 0}>
                Exportar CSV
              </Button>
              <Button onClick={openCreateModal} disabled={isLoading || isSaving}>
                Nuevo registro
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="w-full md:max-w-md">
              <span className="mb-1 block text-sm font-medium text-gray-700">Buscar</span>
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cliente, Teléfono, Placas, Vehículo o Modelo"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <p className="text-sm text-gray-600">
              {filteredAndSortedRecords.length} registro{filteredAndSortedRecords.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {TABLE_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-700"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className="inline-flex items-center gap-1 hover:text-brand-700"
                      >
                        {column.label}
                        {sortField === column.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-gray-500">
                      Cargando registros...
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-gray-500">
                      No hay registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record) => {
                    const isKmDue = record.km >= record.proximoServicioKm;
                    const isDateNear = isNextDateNear(record.proximaFecha);
                    const rowClassName = isKmDue
                      ? 'bg-red-50'
                      : isDateNear
                        ? 'bg-amber-50'
                        : '';

                    return (
                      <tr key={record.id} className={rowClassName}>
                        <td className="whitespace-nowrap px-3 py-3">{record.cliente}</td>
                        <td className="whitespace-nowrap px-3 py-3">{record.telefono}</td>
                        <td className="whitespace-nowrap px-3 py-3">{record.vehiculo}</td>
                        <td className="whitespace-nowrap px-3 py-3">{record.modelo}</td>
                        <td className="whitespace-nowrap px-3 py-3">{record.anio}</td>
                        <td className="whitespace-nowrap px-3 py-3">{record.placas}</td>
                        <td className="whitespace-nowrap px-3 py-3">{record.km.toLocaleString('es-MX')}</td>
                        <td className="px-3 py-3">{record.servicioRealizado}</td>
                        <td className="whitespace-nowrap px-3 py-3">{formatDate(record.fechaServicio)}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {record.proximoServicioKm.toLocaleString('es-MX')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{formatDate(record.proximaFecha)}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="px-3 py-1 text-sm"
                              onClick={() => openEditModal(record)}
                              disabled={isSaving}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              className="px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                              onClick={() => {
                                openDeleteModal(record);
                              }}
                              disabled={isSaving}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              Página {currentPage} de {pageCount}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((previous) => Math.min(pageCount, previous + 1))}
                disabled={currentPage === pageCount || isLoading}
              >
                Siguiente
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-amber-100" /> Próxima fecha cercana
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-red-100" /> Km alcanzó próximo servicio
            </span>
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? 'Editar registro' : 'Nuevo registro'}
              </h2>
              <Button variant="outline" onClick={closeModal}>
                Cerrar
              </Button>
            </div>

            <form
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <label className="text-sm font-medium text-gray-700">
                Cliente
                <input
                  required
                  value={formData.cliente}
                  onChange={(event) => setFormData((previous) => ({ ...previous, cliente: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Teléfono
                <input
                  required
                  value={formData.telefono}
                  onChange={(event) => setFormData((previous) => ({ ...previous, telefono: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Vehículo
                <input
                  required
                  value={formData.vehiculo}
                  onChange={(event) => setFormData((previous) => ({ ...previous, vehiculo: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Modelo
                <input
                  required
                  value={formData.modelo}
                  onChange={(event) => setFormData((previous) => ({ ...previous, modelo: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Año
                <input
                  required
                  type="number"
                  min={1900}
                  max={2100}
                  value={formData.anio}
                  onChange={(event) => setFormData((previous) => ({ ...previous, anio: parseNumber(event.target.value) }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Placas
                <input
                  required
                  value={formData.placas}
                  onChange={(event) => setFormData((previous) => ({ ...previous, placas: event.target.value.toUpperCase() }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 uppercase text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Km
                <input
                  required
                  type="number"
                  min={0}
                  value={formData.km}
                  onChange={(event) => setFormData((previous) => ({ ...previous, km: parseNumber(event.target.value) }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                Servicio realizado
                <input
                  required
                  value={formData.servicioRealizado}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, servicioRealizado: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Fecha de servicio
                <input
                  required
                  type="date"
                  value={formData.fechaServicio}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, fechaServicio: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Próximo servicio (km/millas)
                <input
                  required
                  type="number"
                  min={0}
                  value={formData.proximoServicioKm}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      proximoServicioKm: parseNumber(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                Próxima fecha
                <input
                  required
                  type="date"
                  value={formData.proximaFecha}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, proximaFecha: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>

              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Eliminar registro</h3>
            <p className="mt-2 text-sm text-gray-600">
              Esta acción no se puede deshacer. Se eliminará el registro de{' '}
              <span className="font-semibold text-slate-900">{deleteTarget.cliente}</span> ({deleteTarget.placas}).
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={closeDeleteModal} disabled={isSaving}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                onClick={() => {
                  void confirmDelete();
                }}
                disabled={isSaving}
              >
                {isSaving ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagementPage;
