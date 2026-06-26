import { Link } from 'react-router-dom';

const Logo = ({ className = 'h-8 w-8' }) => (
  <Link to="/" className="flex items-center gap-2 no-underline">
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#0B3C5D" />
      <path d="M8 10h16M8 16h12M8 22h8" stroke="#2FBF71" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    <span className="text-xl font-bold tracking-tight">
      <span style={{ color: '#0B3C5D' }}>bahi</span>
      <span style={{ color: '#2FBF71' }}>360</span>
    </span>
  </Link>
);

export default Logo;
