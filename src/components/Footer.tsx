import React from 'react';
import { Facebook, Instagram, Phone, Mail, MapPin } from 'lucide-react';
import logoImg from '../data/Imagen_de_WhatsApp_2025-11-27_a_las_10.37.40_f36d7afe-removebg-preview.png';
import { NAV_LINKS } from '../constants';
import { useLanguage, localizeField } from '../i18n';

const Footer: React.FC = () => {
  const { t, lang } = useLanguage();
  return (
    <footer id="contact" className="bg-white text-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img src={logoImg} alt="AutoTronica" className="h-14 w-auto" />
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('footer.about')}
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/autotronica.mex" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-brand-500 transition-colors">
                <Facebook size={20} />
              </a>
              <a href="https://www.instagram.com/autotronica.mex/" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-brand-500 transition-colors">
                <Instagram size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">{t('footer.quickLinks')}</h3>
            <ul className="space-y-3">
              {NAV_LINKS.map(link => (
                <li key={JSON.stringify(link.name)}>
                  <a href={link.href} className="text-base text-gray-600 hover:text-brand-500 transition-colors">
                    {localizeField(link.name, lang)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">{t('footer.contactUs')}</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <MapPin size={20} className="mr-3 text-brand-500 flex-shrink-0" />
                <span className="text-sm">
                  {t('footer.address')}
                </span>
              </li>
              <li className="flex items-center">
                <Phone size={20} className="mr-3 text-brand-500 flex-shrink-0" />
                <span className="text-sm">{t('footer.phone')}</span>
              </li>
              <li className="flex items-center">
                <Mail size={20} className="mr-3 text-brand-500 flex-shrink-0" />
                <span className="text-sm">{t('footer.emailAddress')}</span>
              </li>
            </ul>
          </div>

          {/* Business Hours */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">{t('footer.hours')}</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>{t('footer.scheduleLine1')}</li>
              <li>{t('footer.scheduleLine2')}</li>
              <li>{t('footer.scheduleLine3')}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} AutoTronica. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;