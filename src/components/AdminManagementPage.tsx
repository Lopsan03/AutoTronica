import React, { useEffect, useId, useMemo, useState } from 'react';
import Button from './Button';
import { ClientFormData, ClientRecord, ClientServiceRecord, ClientServiceRecordFormData } from '../types';
import { supabase } from '../lib/supabase';

interface AdminManagementPageProps {
  onLogout?: () => void;
}

type DeleteTarget =
  | { type: 'client'; id: string; title: string }
  | { type: 'service'; id: string; title: string }
  | null;

type ClientRow = {
  id: string;
  cliente: string;
  telefono: string;
  vehiculo: string;
  modelo: string;
  anio: number;
  placas: string;
  km_actual: number;
  vehicle_image_url: string | null;
  created_at: string;
};

type ServiceRow = {
  id: string;
  client_id: string;
  servicio_realizado: string;
  fecha_servicio: string;
  km_servicio: number;
  proximo_servicio_km: number | null;
  proxima_fecha: string | null;
  created_at: string;
};

const CLIENT_PAGE_SIZE = 8;
const VEHICLE_IMAGE_BUCKET = 'vehicle-images';
const SUPABASE_CONFIG_ERROR =
  'Faltan variables de entorno de Supabase. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.';

const INITIAL_CLIENT_FORM: ClientFormData = {
  cliente: '',
  telefono: '',
  vehiculo: '',
  modelo: '',
  anio: new Date().getFullYear(),
  placas: '',
  kmActual: 0,
  vehicleImageUrl: '',
};

const INITIAL_SERVICE_FORM: ClientServiceRecordFormData = {
  servicioRealizado: '',
  fechaServicio: '',
  kmServicio: 0,
  proximoServicioKm: null,
  proximaFecha: null,
};

const SERVICE_INTERVALS: Record<string, { km: number | null; dias: number | null }> = {
  'Revisión general multipunto': { km: 5000, dias: 104 },
  'Cambio de aceite y filtro': { km: 7500, dias: 156 },
  'Revisión de batería': { km: 7500, dias: 156 },
  'Revisión sistema de carga (alternador)': { km: 20000, dias: 417 },
  'Revisión de frenos': { km: 10000, dias: 208 },
  'Cambio filtro de aire motor': { km: 12500, dias: 260 },
  'Cambio filtro de cabina': { km: 12500, dias: 260 },
  'Revisión suspensión y dirección': { km: 20000, dias: 417 },
  'Limpieza cuerpo de aceleración': { km: 25000, dias: 521 },
  'Limpieza sensor MAF': { km: 25000, dias: 521 },
  'Limpieza de inyectores': { km: 30000, dias: 625 },
  'Cambio bujías convencionales': { km: 30000, dias: 625 },
  'Cambio bujías iridium/platinum': { km: 90000, dias: 1875 },
  'Cambio válvula PCV': { km: 50000, dias: 1042 },
  'Cambio líquido de frenos': { km: 40000, dias: 833 },
  'Cambio anticongelante': { km: 50000, dias: 1042 },
  'Cambio aceite transmisión automática': { km: 65000, dias: 1354 },
  'Cambio aceite transmisión manual': { km: 80000, dias: 1667 },
  'Cambio banda serpentina': { km: 80000, dias: 1667 },
  'Cambio de balatas': { km: 50000, dias: 1042 },
  'Rectificación de discos': { km: 50000, dias: 1042 },
  'Cambio de discos de freno': { km: 120000, dias: 2500 },
  'Cambio de batería': { km: 60000, dias: 1460 },
  'Cambio amortiguadores': { km: 90000, dias: 1875 },
  'Cambio soportes de motor': { km: 100000, dias: 2083 },
  'Cambio bomba de agua': { km: 120000, dias: 2500 },
  'Diagnóstico con escáner OBD2': { km: null, dias: null },
  'Diagnóstico de vibración': { km: null, dias: null },
  'Diagnóstico sistema eléctrico': { km: null, dias: null },
  'Diagnóstico consumo de combustible': { km: null, dias: null },
  'Diagnóstico sistema de carga': { km: null, dias: null },
  'Falla en el motor': { km: null, dias: null },
  'Falla en transmisión': { km: null, dias: null },
  'Fuga de anticongelante': { km: null, dias: null },
  'Fuga de líquido de frenos': { km: null, dias: null },
  'Luz de check engine': { km: null, dias: null },
  'Cambio alternador': { km: null, dias: null },
  'Cambio motor de arranque': { km: null, dias: null },
};

const mapClientRow = (row: ClientRow): ClientRecord => ({
  id: row.id,
  cliente: row.cliente,
  telefono: row.telefono,
  vehiculo: row.vehiculo,
  modelo: row.modelo,
  anio: row.anio,
  placas: row.placas,
  kmActual: row.km_actual,
  vehicleImageUrl: row.vehicle_image_url ?? '',
});

const mapServiceRow = (row: ServiceRow): ClientServiceRecord => ({
  id: row.id,
  clientId: row.client_id,
  servicioRealizado: row.servicio_realizado,
  fechaServicio: row.fecha_servicio,
  kmServicio: row.km_servicio,
  proximoServicioKm: row.proximo_servicio_km,
  proximaFecha: row.proxima_fecha,
});

const formatDate = (value: string | null) => {
  if (!value) {
    return '-';
  }
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-MX');
};

const isNextDateNear = (nextDate: string | null) => {
  if (!nextDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 14);
  const target = new Date(nextDate);
  return target >= today && target <= limit;
};

type DateUrgency = 'none' | 'on-time' | 'near' | 'due';

const getDateUrgency = (nextDate: string | null): DateUrgency => {
  if (!nextDate) {
    return 'none';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${nextDate}T00:00:00`);
  if (target < today) {
    return 'due';
  }

  if (isNextDateNear(nextDate)) {
    return 'near';
  }

  return 'on-time';
};

const addDays = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const calculateServiceProjection = (serviceName: string, fechaServicio: string, kmServicio: number) => {
  const selectedInterval = SERVICE_INTERVALS[serviceName];
  if (!selectedInterval || !fechaServicio || !Number.isFinite(kmServicio)) {
    return {
      proximoServicioKm: null as number | null,
      proximaFecha: null as string | null,
    };
  }

  return {
    proximoServicioKm: selectedInterval.km === null ? null : kmServicio + selectedInterval.km,
    proximaFecha: selectedInterval.dias === null ? null : addDays(fechaServicio, selectedInterval.dias),
  };
};

const parseNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildFilePath = (clientId: string, fileName: string) => {
  const ext = fileName.split('.').pop() || 'jpg';
  return `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
};

const AdminManagementPage: React.FC<AdminManagementPageProps> = ({ onLogout }) => {
  const vehicleImageInputId = useId();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [services, setServices] = useState<ClientServiceRecord[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchClient, setSearchClient] = useState('');
  const [clientPage, setClientPage] = useState(1);
  const [searchService, setSearchService] = useState('');

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<ClientFormData>(INITIAL_CLIENT_FORM);
  const [clientImageFile, setClientImageFile] = useState<File | null>(null);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<ClientServiceRecordFormData>(INITIAL_SERVICE_FORM);
  const [batchServiceForm, setBatchServiceForm] = useState({ fechaServicio: '', kmServicio: 0 });
  const [batchServiceSelection, setBatchServiceSelection] = useState('');
  const [batchSelectedServices, setBatchSelectedServices] = useState<string[]>([]);
  const [selectedServiceClientId, setSelectedServiceClientId] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const clientById = useMemo(() => {
    return new Map(clients.map((client) => [client.id, client]));
  }, [clients]);

  const serviceOptions = useMemo(() => {
    const options = Object.keys(SERVICE_INTERVALS);
    if (serviceForm.servicioRealizado && !options.includes(serviceForm.servicioRealizado)) {
      return [serviceForm.servicioRealizado, ...options];
    }
    return options;
  }, [serviceForm.servicioRealizado]);

  const filteredServices = useMemo(() => {
    const normalized = searchService.trim().toLowerCase();

    return services.filter((service) => {
      const client = clientById.get(service.clientId);
      if (!client) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const searchable = [
        client.cliente,
        client.telefono,
        client.placas,
        client.vehiculo,
        client.modelo,
        service.servicioRealizado,
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalized);
    });
  }, [services, clientById, searchService]);

  const filteredClients = useMemo(() => {
    const normalized = searchClient.trim().toLowerCase();
    if (!normalized) {
      return clients;
    }
    return clients.filter((client) =>
      [client.cliente, client.telefono, client.placas, client.vehiculo, client.modelo]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [clients, searchClient]);

  const clientPageCount = Math.max(1, Math.ceil(filteredClients.length / CLIENT_PAGE_SIZE));

  const paginatedClients = useMemo(() => {
    const start = (clientPage - 1) * CLIENT_PAGE_SIZE;
    return filteredClients.slice(start, start + CLIENT_PAGE_SIZE);
  }, [filteredClients, clientPage]);

  useEffect(() => {
    if (clientPage > clientPageCount) {
      setClientPage(clientPageCount);
    }
  }, [clientPage, clientPageCount]);

  const loadClients = async () => {
    if (!supabase) {
      setErrorMessage(SUPABASE_CONFIG_ERROR);
      setIsLoadingClients(false);
      return;
    }

    setIsLoadingClients(true);
    setErrorMessage('');

    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (error) {
      setErrorMessage('No se pudieron cargar los clientes. Verifica la nueva estructura de Supabase.');
      setIsLoadingClients(false);
      return;
    }

    const mapped = (data as ClientRow[]).map(mapClientRow);
    setClients(mapped);

    if (mapped.length === 0) {
      setSelectedClientId(null);
    } else if (!mapped.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(mapped[0].id);
    }

    setIsLoadingClients(false);
  };

  const loadServices = async () => {
    if (!supabase) {
      setErrorMessage(SUPABASE_CONFIG_ERROR);
      setIsLoadingServices(false);
      return;
    }

    setIsLoadingServices(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('client_services')
      .select('*')
      .order('fecha_servicio', { ascending: false });

    if (error) {
      setErrorMessage('No se pudieron cargar los servicios del cliente.');
      setIsLoadingServices(false);
      return;
    }

    setServices((data as ServiceRow[]).map(mapServiceRow));
    setIsLoadingServices(false);
  };

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (clients.length === 0) {
      setSelectedServiceClientId('');
    } else if (!selectedServiceClientId || !clients.some((client) => client.id === selectedServiceClientId)) {
      setSelectedServiceClientId(selectedClientId ?? clients[0].id);
    }
  }, [clients, selectedClientId, selectedServiceClientId]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    void loadServices();
  }, []);

  useEffect(() => {
    const selectedInterval = SERVICE_INTERVALS[serviceForm.servicioRealizado];

    if (!selectedInterval || !serviceForm.fechaServicio || !Number.isFinite(serviceForm.kmServicio)) {
      setServiceForm((previous) => ({
        ...previous,
        proximoServicioKm: null,
        proximaFecha: null,
      }));
      return;
    }

    setServiceForm((previous) => ({
      ...previous,
      proximoServicioKm:
        selectedInterval.km === null ? null : serviceForm.kmServicio + selectedInterval.km,
      proximaFecha:
        selectedInterval.dias === null ? null : addDays(serviceForm.fechaServicio, selectedInterval.dias),
    }));
  }, [serviceForm.servicioRealizado, serviceForm.kmServicio, serviceForm.fechaServicio]);

  const batchServiceRows = useMemo(() => {
    return batchSelectedServices.map((serviceName) => {
      const projection = calculateServiceProjection(
        serviceName,
        batchServiceForm.fechaServicio,
        batchServiceForm.kmServicio
      );

      return {
        serviceName,
        proximoServicioKm: projection.proximoServicioKm,
        proximaFecha: projection.proximaFecha,
      };
    });
  }, [batchSelectedServices, batchServiceForm.fechaServicio, batchServiceForm.kmServicio]);

  const closeClientModal = () => {
    if (isSaving) {
      return;
    }
    setIsClientModalOpen(false);
    setEditingClientId(null);
    setClientForm(INITIAL_CLIENT_FORM);
    setClientImageFile(null);
  };

  const closeServiceModal = () => {
    if (isSaving) {
      return;
    }
    setIsServiceModalOpen(false);
    setEditingServiceId(null);
    setServiceForm(INITIAL_SERVICE_FORM);
    setBatchServiceForm({ fechaServicio: '', kmServicio: 0 });
    setBatchServiceSelection('');
    setBatchSelectedServices([]);
    setSelectedServiceClientId('');
  };

  const openCreateClient = () => {
    setEditingClientId(null);
    setClientForm(INITIAL_CLIENT_FORM);
    setClientImageFile(null);
    setIsClientModalOpen(true);
  };

  const openEditClient = (client: ClientRecord) => {
    setEditingClientId(client.id);
    setClientForm({
      cliente: client.cliente,
      telefono: client.telefono,
      vehiculo: client.vehiculo,
      modelo: client.modelo,
      anio: client.anio,
      placas: client.placas,
      kmActual: client.kmActual,
      vehicleImageUrl: client.vehicleImageUrl,
    });
    setClientImageFile(null);
    setIsClientModalOpen(true);
  };

  const openCreateService = () => {
    setEditingServiceId(null);
    setServiceForm(INITIAL_SERVICE_FORM);
    setBatchServiceForm({ fechaServicio: '', kmServicio: 0 });
    setBatchServiceSelection('');
    setBatchSelectedServices([]);
    setSelectedServiceClientId(selectedClientId ?? clients[0]?.id ?? '');
    setIsServiceModalOpen(true);
  };

  const openEditService = (service: ClientServiceRecord) => {
    setEditingServiceId(service.id);
    setSelectedServiceClientId(service.clientId);
    setServiceForm({
      servicioRealizado: service.servicioRealizado,
      fechaServicio: service.fechaServicio,
      kmServicio: service.kmServicio,
      proximoServicioKm: service.proximoServicioKm,
      proximaFecha: service.proximaFecha,
    });
    setIsServiceModalOpen(true);
  };

  const uploadVehicleImage = async (clientId: string, file: File) => {
    if (!supabase) {
      throw new Error(SUPABASE_CONFIG_ERROR);
    }

    const filePath = buildFilePath(clientId, file.name);
    const { error } = await supabase.storage.from(VEHICLE_IMAGE_BUCKET).upload(filePath, file, { upsert: true });

    if (error) {
      throw new Error('No se pudo subir la imagen. Revisa que exista el bucket vehicle-images y sus políticas.');
    }

    const { data } = supabase.storage.from(VEHICLE_IMAGE_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleClientSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setErrorMessage(SUPABASE_CONFIG_ERROR);
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const payload = {
      cliente: clientForm.cliente,
      telefono: clientForm.telefono,
      vehiculo: clientForm.vehiculo,
      modelo: clientForm.modelo,
      anio: clientForm.anio,
      placas: clientForm.placas,
      km_actual: clientForm.kmActual,
    };

    try {
      if (editingClientId) {
        const updateData: { [key: string]: string | number } = { ...payload };

        if (clientImageFile) {
          updateData.vehicle_image_url = await uploadVehicleImage(editingClientId, clientImageFile);
        }

        const { data, error } = await supabase
          .from('clients')
          .update(updateData)
          .eq('id', editingClientId)
          .select('*')
          .single();

        if (error) {
          throw new Error('No se pudo actualizar el cliente.');
        }

        const mapped = mapClientRow(data as ClientRow);
        setClients((previous) => previous.map((client) => (client.id === mapped.id ? mapped : client)));
      } else {
        const { data, error } = await supabase.from('clients').insert(payload).select('*').single();

        if (error) {
          throw new Error('No se pudo crear el cliente.');
        }

        let mapped = mapClientRow(data as ClientRow);

        if (clientImageFile) {
          const vehicleImageUrl = await uploadVehicleImage(mapped.id, clientImageFile);
          const { data: updated, error: updateError } = await supabase
            .from('clients')
            .update({ vehicle_image_url: vehicleImageUrl })
            .eq('id', mapped.id)
            .select('*')
            .single();

          if (updateError) {
            throw new Error('El cliente se creó, pero no se pudo guardar la imagen.');
          }

          mapped = mapClientRow(updated as ClientRow);
        }

        setClients((previous) => [mapped, ...previous]);
        setSelectedClientId(mapped.id);
      }

      closeClientModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleServiceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedServiceClientId) {
      setErrorMessage('Selecciona un cliente para este servicio.');
      return;
    }
    if (!supabase) {
      setErrorMessage(SUPABASE_CONFIG_ERROR);
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (editingServiceId) {
        const payload = {
          client_id: selectedServiceClientId,
          servicio_realizado: serviceForm.servicioRealizado,
          fecha_servicio: serviceForm.fechaServicio,
          km_servicio: serviceForm.kmServicio,
          proximo_servicio_km: serviceForm.proximoServicioKm,
          proxima_fecha: serviceForm.proximaFecha,
        };

        const { data, error } = await supabase
          .from('client_services')
          .update(payload)
          .eq('id', editingServiceId)
          .select('*')
          .single();

        if (error) {
          throw new Error('No se pudo actualizar el servicio.');
        }

        const mapped = mapServiceRow(data as ServiceRow);
        setServices((previous) => previous.map((service) => (service.id === mapped.id ? mapped : service)));
      } else {
        if (!batchServiceForm.fechaServicio || !Number.isFinite(batchServiceForm.kmServicio)) {
          throw new Error('Captura fecha y km de servicio para crear los servicios.');
        }

        if (batchSelectedServices.length === 0) {
          throw new Error('Agrega al menos un servicio para registrar.');
        }

        const payloads = batchSelectedServices.map((serviceName) => {
          const projection = calculateServiceProjection(
            serviceName,
            batchServiceForm.fechaServicio,
            batchServiceForm.kmServicio
          );

          return {
            client_id: selectedServiceClientId,
            servicio_realizado: serviceName,
            fecha_servicio: batchServiceForm.fechaServicio,
            km_servicio: batchServiceForm.kmServicio,
            proximo_servicio_km: projection.proximoServicioKm,
            proxima_fecha: projection.proximaFecha,
          };
        });

        const { data, error } = await supabase.from('client_services').insert(payloads).select('*');
        if (error) {
          throw new Error('No se pudieron crear los servicios.');
        }

        const mappedServices = (data as ServiceRow[]).map(mapServiceRow);
        setServices((previous) => [...mappedServices, ...previous]);
      }

      closeServiceModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el servicio.');
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteClient = (client: ClientRecord) => {
    setDeleteTarget({ type: 'client', id: client.id, title: client.cliente });
  };

  const openDeleteService = (service: ClientServiceRecord) => {
    setDeleteTarget({ type: 'service', id: service.id, title: service.servicioRealizado });
  };

  const addBatchService = () => {
    if (!batchServiceSelection) {
      return;
    }

    setBatchSelectedServices((previous) => {
      if (previous.includes(batchServiceSelection)) {
        return previous;
      }
      return [...previous, batchServiceSelection];
    });
    setBatchServiceSelection('');
  };

  const removeBatchService = (serviceName: string) => {
    setBatchSelectedServices((previous) => previous.filter((service) => service !== serviceName));
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
    if (!supabase) {
      setErrorMessage(SUPABASE_CONFIG_ERROR);
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (deleteTarget.type === 'client') {
        const { error } = await supabase.from('clients').delete().eq('id', deleteTarget.id);
        if (error) {
          throw new Error('No se pudo eliminar el cliente.');
        }

        setClients((previous) => previous.filter((client) => client.id !== deleteTarget.id));
        setServices((previous) => previous.filter((service) => service.clientId !== deleteTarget.id));
        if (selectedClientId === deleteTarget.id) {
          const fallback = clients.find((client) => client.id !== deleteTarget.id);
          setSelectedClientId(fallback?.id ?? null);
        }
      } else {
        const { error } = await supabase.from('client_services').delete().eq('id', deleteTarget.id);
        if (error) {
          throw new Error('No se pudo eliminar el servicio.');
        }

        setServices((previous) => previous.filter((service) => service.id !== deleteTarget.id));
      }

      setDeleteTarget(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo eliminar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Administración de Clientes y Servicios</h1>
              <p className="mt-1 text-sm text-gray-600">
                Crea clientes y administra múltiples servicios por vehículo.
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
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="w-full md:max-w-md">
              <span className="mb-1 block text-sm font-medium text-gray-700">Buscar cliente</span>
              <input
                value={searchClient}
                onChange={(event) => {
                  setSearchClient(event.target.value);
                  setClientPage(1);
                }}
                placeholder="Cliente, teléfono, placas, vehículo o modelo"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <Button onClick={openCreateClient} disabled={isSaving}>
              Nuevo cliente
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Foto</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Cliente</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Teléfono</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Vehículo</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Modelo</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Año</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Placas</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Km actual</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoadingClients ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      Cargando clientes...
                    </td>
                  </tr>
                ) : paginatedClients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      No hay clientes para mostrar.
                    </td>
                  </tr>
                ) : (
                  paginatedClients.map((client) => {
                    const isSelected = client.id === selectedClientId;
                    return (
                      <tr
                        key={client.id}
                        className={isSelected ? 'bg-brand-50/40' : 'hover:bg-gray-50'}
                        onClick={() => setSelectedClientId(client.id)}
                      >
                        <td className="px-3 py-3">
                          {client.vehicleImageUrl ? (
                            <img
                              src={client.vehicleImageUrl}
                              alt={`Vehículo de ${client.cliente}`}
                              className="h-12 w-16 rounded-md object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-16 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-500">
                              Sin foto
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">{client.cliente}</td>
                        <td className="whitespace-nowrap px-3 py-3">{client.telefono}</td>
                        <td className="whitespace-nowrap px-3 py-3">{client.vehiculo}</td>
                        <td className="whitespace-nowrap px-3 py-3">{client.modelo}</td>
                        <td className="whitespace-nowrap px-3 py-3">{client.anio}</td>
                        <td className="whitespace-nowrap px-3 py-3">{client.placas}</td>
                        <td className="whitespace-nowrap px-3 py-3">{client.kmActual.toLocaleString('es-MX')}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="px-3 py-1 text-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditClient(client);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              className="px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDeleteClient(client);
                              }}
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
              Página {clientPage} de {clientPageCount}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setClientPage((previous) => Math.max(1, previous - 1))}
                disabled={clientPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={() => setClientPage((previous) => Math.min(clientPageCount, previous + 1))}
                disabled={clientPage === clientPageCount}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Servicios por cliente</h2>
              <p className="text-sm text-gray-600">Administra el historial de servicios de todos los clientes.</p>
            </div>
            <Button onClick={openCreateService} disabled={clients.length === 0 || isSaving}>
              Nuevo servicio
            </Button>
          </div>

          <div className="mb-4">
            <label className="w-full md:max-w-md">
              <span className="mb-1 block text-sm font-medium text-gray-700">Filtrar servicios</span>
              <input
                value={searchService}
                onChange={(event) => setSearchService(event.target.value)}
                placeholder="Cliente, placas, teléfono, vehículo, modelo o servicio"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
          </div>

          {clients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
              Primero crea o selecciona un cliente.
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <span className="font-semibold text-slate-800">Clave de colores (Próxima fecha):</span>
                <span className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                  Vencido
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                  Próximo (14 días)
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                  En tiempo
                </span>
                <span className="inline-flex items-center gap-2 text-gray-500">Sin próxima fecha no se colorea.</span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Cliente</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Placas</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Vehículo</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Servicio realizado</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Fecha de servicio</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Km en servicio</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Próximo servicio</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Próxima fecha</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Estado</th>
                      <th className="px-3 py-3 text-left font-semibold text-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {isLoadingServices ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                          Cargando servicios...
                        </td>
                      </tr>
                    ) : filteredServices.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                          No hay servicios que coincidan con el filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredServices.map((service) => {
                        const relatedClient = clientById.get(service.clientId);
                        if (!relatedClient) {
                          return null;
                        }

                        const dateUrgency = getDateUrgency(service.proximaFecha);
                        const statusLabel =
                          dateUrgency === 'due'
                            ? 'Vencido'
                            : dateUrgency === 'near'
                              ? 'Próximo'
                              : dateUrgency === 'on-time'
                                ? 'En tiempo'
                                : 'Sin fecha';

                        const nextDateCellClass =
                          dateUrgency === 'due'
                            ? 'bg-red-100 text-red-800 font-semibold'
                            : dateUrgency === 'near'
                              ? 'bg-amber-100 text-amber-800 font-semibold'
                              : dateUrgency === 'on-time'
                                ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                : '';

                        return (
                          <tr key={service.id}>
                            <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">
                              {relatedClient.cliente}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">{relatedClient.placas}</td>
                            <td className="whitespace-nowrap px-3 py-3">
                              {relatedClient.vehiculo} {relatedClient.modelo}
                            </td>
                            <td className="px-3 py-3">{service.servicioRealizado}</td>
                            <td className="whitespace-nowrap px-3 py-3">{formatDate(service.fechaServicio)}</td>
                            <td className="whitespace-nowrap px-3 py-3">
                              {service.kmServicio.toLocaleString('es-MX')}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              {service.proximoServicioKm === null
                                ? '-'
                                : service.proximoServicioKm.toLocaleString('es-MX')}
                            </td>
                            <td className={`whitespace-nowrap px-3 py-3 ${nextDateCellClass}`}>
                              {formatDate(service.proximaFecha)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-700">
                              {statusLabel}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="px-3 py-1 text-sm"
                                  onClick={() => openEditService(service)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  className="px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                                  onClick={() => openDeleteService(service)}
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
            </>
          )}
        </section>
      </div>

      {isClientModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4" role="dialog" aria-modal>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">
                {editingClientId ? 'Editar cliente' : 'Nuevo cliente'}
              </h3>
              <Button variant="outline" onClick={closeClientModal}>
                Cerrar
              </Button>
            </div>

            <form onSubmit={(event) => void handleClientSubmit(event)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Cliente
                <input
                  required
                  value={clientForm.cliente}
                  onChange={(event) => setClientForm((previous) => ({ ...previous, cliente: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Teléfono
                <input
                  required
                  value={clientForm.telefono}
                  onChange={(event) => setClientForm((previous) => ({ ...previous, telefono: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Vehículo
                <input
                  required
                  value={clientForm.vehiculo}
                  onChange={(event) => setClientForm((previous) => ({ ...previous, vehiculo: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Modelo
                <input
                  required
                  value={clientForm.modelo}
                  onChange={(event) => setClientForm((previous) => ({ ...previous, modelo: event.target.value }))}
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
                  value={clientForm.anio}
                  onChange={(event) => setClientForm((previous) => ({ ...previous, anio: parseNumber(event.target.value) }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Placas
                <input
                  required
                  value={clientForm.placas}
                  onChange={(event) =>
                    setClientForm((previous) => ({ ...previous, placas: event.target.value.toUpperCase() }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 uppercase text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Km actual
                <input
                  required
                  type="number"
                  min={0}
                  value={clientForm.kmActual === 0 ? '' : clientForm.kmActual}
                  placeholder="Ingresa km actual"
                  onChange={(event) =>
                    setClientForm((previous) => ({ ...previous, kmActual: parseNumber(event.target.value) }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                Foto del vehículo
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    id={vehicleImageInputId}
                    type="file"
                    accept="image/*"
                    onChange={(event) => setClientImageFile(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                  <label
                    htmlFor={vehicleImageInputId}
                    className="inline-flex cursor-pointer items-center rounded-md border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
                  >
                    Seleccionar foto
                  </label>
                  <span className="text-sm text-gray-600">
                    {clientImageFile ? clientImageFile.name : 'Ningún archivo seleccionado'}
                  </span>
                </div>
                {clientForm.vehicleImageUrl && !clientImageFile && (
                  <img
                    src={clientForm.vehicleImageUrl}
                    alt="Vista previa vehículo"
                    className="mt-3 h-28 w-40 rounded-md object-cover"
                  />
                )}
              </label>
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeClientModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : editingClientId ? 'Actualizar cliente' : 'Crear cliente'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isServiceModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4" role="dialog" aria-modal>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">
                {editingServiceId ? 'Editar servicio' : 'Nuevo servicio'}
              </h3>
              <Button variant="outline" onClick={closeServiceModal}>
                Cerrar
              </Button>
            </div>

            <form onSubmit={(event) => void handleServiceSubmit(event)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                Cliente asociado
                <select
                  required
                  value={selectedServiceClientId}
                  onChange={(event) => setSelectedServiceClientId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.cliente} - {client.placas} ({client.vehiculo} {client.modelo})
                    </option>
                  ))}
                </select>
              </label>
              {editingServiceId ? (
                <>
                  <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                    Servicio realizado
                    <select
                      required
                      value={serviceForm.servicioRealizado}
                      onChange={(event) =>
                        setServiceForm((previous) => ({ ...previous, servicioRealizado: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Selecciona un servicio</option>
                      {serviceOptions.map((serviceName) => (
                        <option key={serviceName} value={serviceName}>
                          {serviceName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Fecha de servicio
                    <input
                      required
                      type="date"
                      value={serviceForm.fechaServicio}
                      onChange={(event) =>
                        setServiceForm((previous) => ({ ...previous, fechaServicio: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Km en servicio
                    <input
                      required
                      type="number"
                      min={0}
                      value={serviceForm.kmServicio === 0 ? '' : serviceForm.kmServicio}
                      placeholder="Ingresa km del servicio"
                      onChange={(event) =>
                        setServiceForm((previous) => ({ ...previous, kmServicio: parseNumber(event.target.value) }))
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Próximo servicio (km/millas)
                    <input
                      type="text"
                      value={
                        serviceForm.proximoServicioKm === null
                          ? ''
                          : serviceForm.proximoServicioKm.toLocaleString('es-MX')
                      }
                      readOnly
                      placeholder="Se calcula automáticamente"
                      className="mt-1 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-slate-900"
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Próxima fecha
                    <input
                      type="text"
                      value={serviceForm.proximaFecha ?? ''}
                      readOnly
                      placeholder="Se calcula automáticamente"
                      className="mt-1 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-slate-900"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="text-sm font-medium text-gray-700">
                    Fecha de servicio
                    <input
                      required
                      type="date"
                      value={batchServiceForm.fechaServicio}
                      onChange={(event) =>
                        setBatchServiceForm((previous) => ({ ...previous, fechaServicio: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-700">
                    Km en servicio
                    <input
                      required
                      type="number"
                      min={0}
                      value={batchServiceForm.kmServicio === 0 ? '' : batchServiceForm.kmServicio}
                      placeholder="Ingresa km del servicio"
                      onChange={(event) =>
                        setBatchServiceForm((previous) => ({ ...previous, kmServicio: parseNumber(event.target.value) }))
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </label>
                  <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <span className="block text-sm font-medium text-gray-700">Servicios de esta visita</span>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={batchServiceSelection}
                        onChange={(event) => setBatchServiceSelection(event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Selecciona un servicio para agregar</option>
                        {Object.keys(SERVICE_INTERVALS).map((serviceName) => (
                          <option key={serviceName} value={serviceName}>
                            {serviceName}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" onClick={addBatchService}>
                        Agregar
                      </Button>
                    </div>

                    {batchServiceRows.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-600">Aún no agregas servicios para esta visita.</p>
                    ) : (
                      <div className="mt-3 overflow-x-auto rounded-md border border-gray-200 bg-white">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-700">Servicio</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-700">Próximo servicio</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-700">Próxima fecha</th>
                              <th className="px-3 py-2 text-left font-semibold text-slate-700">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {batchServiceRows.map((row) => (
                              <tr key={row.serviceName}>
                                <td className="px-3 py-2">{row.serviceName}</td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  {row.proximoServicioKm === null
                                    ? '-'
                                    : row.proximoServicioKm.toLocaleString('es-MX')}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">{formatDate(row.proximaFecha)}</td>
                                <td className="px-3 py-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                                    onClick={() => removeBatchService(row.serviceName)}
                                  >
                                    Quitar
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeServiceModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving || !selectedServiceClientId}>
                  {isSaving
                    ? 'Guardando...'
                    : editingServiceId
                      ? 'Actualizar servicio'
                      : `Crear ${batchSelectedServices.length || 0} servicio(s)`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Eliminar registro</h3>
            <p className="mt-2 text-sm text-gray-600">
              Esta acción no se puede deshacer. Se eliminará{' '}
              <span className="font-semibold text-slate-900">{deleteTarget.title}</span>.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={closeDeleteModal} disabled={isSaving}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                onClick={() => void confirmDelete()}
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
