import { LucideIcon } from 'lucide-react';

export interface LocalizedString {
  en: string;
  es: string;
}

export interface ServiceItem {
  id: string;
  title: string | LocalizedString;
  description: string | LocalizedString;
  icon: LucideIcon;
}

export interface InquiryFormData {
  fullName: string;
  email: string;
  phone: string;
  zipCode: string;
  year: string;
  make: string;
  model: string;
}

export interface ServiceCategory {
  id: string;
  title: string | LocalizedString;
  services: ServiceItem[];
}

export interface SelectedService {
  serviceId: string;
  title: string;
  location: 'shop' | 'home';
  date?: string;
  time?: string;
}

export interface FormContextType {
  formData: InquiryFormData;
  setFormData: (data: InquiryFormData) => void;
  selectedServices: SelectedService[];
  setSelectedServices: (services: SelectedService[]) => void;
  currentStep: 'inquiry' | 'services';
  setCurrentStep: (step: 'inquiry' | 'services') => void;
}

export enum FormStatus {
  IDLE = 'IDLE',
  SUBMITTING = 'SUBMITTING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ClientServiceRecord {
  id: string;
  cliente: string;
  telefono: string;
  vehiculo: string;
  modelo: string;
  anio: number;
  placas: string;
  km: number;
  servicioRealizado: string;
  fechaServicio: string;
  proximoServicioKm: number;
  proximaFecha: string;
}

export type ClientServiceRecordFormData = Omit<ClientServiceRecord, 'id'>;