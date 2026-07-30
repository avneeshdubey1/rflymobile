const seasons = [
  { key: 'kharif', label: 'Kharif' },
  { key: 'rabi', label: 'Rabi' },
  { key: 'summer', label: 'Summer' },
];

function CustomerProfileFields({ value, onChange, idPrefix = 'customer' }) {
  const field = (name) => ({
    value: value[name] ?? '',
    onChange: (event) => onChange({ ...value, [name]: event.target.value }),
  });

  return (
    <>
      <div className="row-group">
        <div className="input-group"><label htmlFor={`${idPrefix}-ownership`}>Farmer ownership</label><select id={`${idPrefix}-ownership`} {...field('ownership')}><option value="">Not recorded</option><option value="OWNER">Owner</option><option value="TENANT">Tenant</option></select></div>
        <div className="input-group"><label htmlFor={`${idPrefix}-total-acres`}>Total acres</label><input id={`${idPrefix}-total-acres`} type="number" min="0" step="0.01" {...field('totalAcres')} /></div>
      </div>
      <div className="row-group">
        <div className="input-group"><label htmlFor={`${idPrefix}-village`}>Village</label><input id={`${idPrefix}-village`} type="text" maxLength="120" {...field('village')} /></div>
        <div className="input-group"><label htmlFor={`${idPrefix}-mandal`}>Mandal</label><input id={`${idPrefix}-mandal`} type="text" maxLength="120" {...field('mandal')} /></div>
      </div>
      <div className="row-group">
        <div className="input-group"><label htmlFor={`${idPrefix}-district`}>District</label><input id={`${idPrefix}-district`} type="text" maxLength="120" {...field('district')} /></div>
        <div className="input-group"><label htmlFor={`${idPrefix}-state`}>State</label><input id={`${idPrefix}-state`} type="text" maxLength="120" {...field('state')} /></div>
      </div>
      {seasons.map(({ key, label }) => (
        <fieldset className="workflow-card" key={key}>
          <legend>{label} crop details</legend>
          <div className="row-group">
            <div className="input-group"><label htmlFor={`${idPrefix}-${key}-crop`}>Crop</label><input id={`${idPrefix}-${key}-crop`} type="text" maxLength="120" {...field(`${key}Crop`)} /></div>
            <div className="input-group"><label htmlFor={`${idPrefix}-${key}-other-crop`}>Other crop / variety</label><input id={`${idPrefix}-${key}-other-crop`} type="text" maxLength="120" {...field(`${key}OtherCrop`)} /></div>
          </div>
          <div className="row-group">
            <div className="input-group"><label htmlFor={`${idPrefix}-${key}-acres`}>Acres</label><input id={`${idPrefix}-${key}-acres`} type="number" min="0" step="0.01" {...field(`${key}Acres`)} /></div>
            <div className="input-group"><label htmlFor={`${idPrefix}-${key}-tanks`}>Tank estimate</label><input id={`${idPrefix}-${key}-tanks`} type="number" min="0" step="0.01" {...field(`${key}Tanks`)} /></div>
            <div className="input-group"><label htmlFor={`${idPrefix}-${key}-sprayings`}>Expected sprayings</label><input id={`${idPrefix}-${key}-sprayings`} type="number" min="0" step="1" {...field(`${key}Sprayings`)} /></div>
          </div>
        </fieldset>
      ))}
      <div className="row-group">
        <div className="input-group"><label htmlFor={`${idPrefix}-subscription-card`}>Subscription card number</label><input id={`${idPrefix}-subscription-card`} type="text" maxLength="80" {...field('subscriptionCardNumber')} /></div>
        <div className="input-group"><label htmlFor={`${idPrefix}-subscription-year`}>Subscription year</label><input id={`${idPrefix}-subscription-year`} type="text" maxLength="20" placeholder="For example, 2026-27" {...field('subscriptionYear')} /></div>
      </div>
      <div className="input-group"><label htmlFor={`${idPrefix}-remarks`}>Remarks</label><textarea id={`${idPrefix}-remarks`} rows="3" maxLength="1000" {...field('remarks')} /></div>
    </>
  );
}

export default CustomerProfileFields;
