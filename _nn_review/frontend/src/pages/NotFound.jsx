import { useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();
  return (
    <main className="not-found">
      <section className="panel not-found__card">
        <p className="eyebrow eyebrow--accent">404 · Route unavailable</p>
        <h1>This workspace could not be found.</h1>
        <p>The address may be incomplete, or your account may need a different operational workspace.</p>
        <div className="button-row"><button className="submit-btn" type="button" onClick={() => navigate('/')}>Return to service request</button><button className="action-btn" type="button" onClick={() => navigate('/login')}>Employee login</button></div>
      </section>
    </main>
  );
}

export default NotFound;
