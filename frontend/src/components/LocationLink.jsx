import { describeLocation, googleMapsUrl } from '../utils/locationPresentation';
import { useTranslation } from 'react-i18next';

function LocationLink({ latitude, longitude, address, label, centerName, farmerName, pilotName, fallback, onClick, className = '', showDisclosure = true }) {
  const { t } = useTranslation();
  const location = { latitude, longitude, address, label };
  const description = describeLocation({ ...location, centerName, farmerName, pilotName, fallback });
  const href = googleMapsUrl(location);
  if (!href) return <span className={`location-label ${className}`.trim()}>{description}</span>;

  return (
    <span className="location-link-group">
      <a
        className={`location-link ${className}`.trim()}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={onClick}
      >
        <span>{description}</span><span aria-hidden="true">-&gt;</span>
      </a>
      {showDisclosure && <small>{t('map_link_privacy')}</small>}
    </span>
  );
}

export default LocationLink;
