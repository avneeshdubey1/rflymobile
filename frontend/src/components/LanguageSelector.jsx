import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import OpsIcon from './OpsIcon';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';
import { API_URL } from '../config';

export default function LanguageSelector({ style, className }) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(() => localStorage.getItem('preferredLanguage') || 'en');
  const [isOpen, setIsOpen] = useState(false);

  const currentLangLabel = supportedLanguages.find(l => l.code === language)?.label || 'English';

  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
    void i18n.changeLanguage(language);
  }, [language, i18n]);

  const handleSelect = async (code) => {
    setLanguage(code);
    setIsOpen(false);
    
    if (user) {
      try {
        await fetch(`${API_URL}/api/users/preferences`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ language: code })
        });
      } catch (err) {
        console.error('Failed to sync language preference', err);
      }
    }
    window.location.reload();
  };

  return (
    <div className={`language-selector ${className || ''}`} style={{ position: 'relative', ...style }}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--text-main)',
          fontSize: '0.9rem'
        }}
      >
        <OpsIcon name="globe" size={16} />
        <span>{currentLangLabel}</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.25rem',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 100,
          minWidth: '150px',
          overflow: 'hidden'
        }}>
          {supportedLanguages.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                background: lang.code === language ? 'var(--surface-sunken)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-main)',
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
