export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" id="site-footer">
      <div className="footer-inner">
        <p className="footer-text">
          <span className="footer-brand">GariLelo<span className="footer-brand-ai">AI</span></span>
          {' '}aggregates listings from{' '}
          <strong>OLX</strong>, <strong>PakWheels</strong> and <strong>CarFirst</strong>.
          {' '}All prices reflect most-recent seller prices.
        </p>
        <p className="footer-copy">
          © {currentYear} GariLeloAI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
