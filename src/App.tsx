import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ServicesSection from './components/ServicesSection';
import InquiryForm from './components/InquiryForm';
import ServiceSelection from './components/ServiceSelection';
import Footer from './components/Footer';
import AdminManagementPage from './components/AdminManagementPage';
import AdminLogin from './components/AdminLogin';
import { LanguageProvider } from './i18n';
import { FormProvider, useFormContext } from './FormContext';

const ADMIN_SESSION_KEY = 'adminAuthenticated';

function AppContent() {
  const { currentStep } = useFormContext();

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-900 selection:bg-brand-500 selection:text-white">
      <Header />
      <main>
        {currentStep === 'inquiry' ? (
          <>
            <Hero />
            <ServicesSection />
            <InquiryForm />
          </>
        ) : (
          <ServiceSelection />
        )}
      </main>
      <Footer />
    </div>
  );
}

function App() {
  const isAdminPage = window.location.pathname.toLowerCase().startsWith('/admin');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(
    sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true'
  );

  const handleLogin = () => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    setIsAdminAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdminAuthenticated(false);
  };

  if (isAdminPage) {
    return isAdminAuthenticated ? (
      <AdminManagementPage onLogout={handleLogout} />
    ) : (
      <AdminLogin onLogin={handleLogin} />
    );
  }

  return (
    <LanguageProvider>
      <FormProvider>
        <AppContent />
      </FormProvider>
    </LanguageProvider>
  );
}

export default App;