import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import OpsIcon from './OpsIcon';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';
import { apiFetch } from '../services/apiClient';

export default function LanguageSelector({ style, className }) {
  const { user } = useAuth();
  const { i18n, t } = useTranslation();
  const [language, setLanguage] = useState(() => localStorage.getItem('preferredLanguage') || 'en');
  const [isOpen, setIsOpen] = useState(false);

  const currentLangLabel = supportedLanguages.find(l => l.code === language)?.label || 'English';
  const rootClassName = ['language-selector', className].filter(Boolean).join(' ');

  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
    void i18n.changeLanguage(language);
  }, [language, i18n]);

  const handleSelect = async (code) => {
    setLanguage(code);
    setIsOpen(false);
    
    if (user) {
      try {
        await apiFetch('/api/users/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ language: code })
        });
      } catch (err) {
        console.error('Failed to sync language preference', err);
      }
    }
  };

  return (
    <div className={rootClassName} style={{ position: 'relative', ...style }}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="language-selector__trigger"
        aria-label={t('preferred_language', 'Preferred language')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <OpsIcon name="globe" size={16} />
        <span>{currentLangLabel}</span>
      </button>

      {isOpen && (
        <div className="language-selector__menu" role="listbox" aria-label={t('preferred_language', 'Preferred language')}>
          {supportedLanguages.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`language-selector__option${lang.code === language ? ' language-selector__option--active' : ''}`}
              role="option"
              aria-selected={lang.code === language}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
