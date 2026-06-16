import { Link } from 'react-router-dom';

const Logo = ({ className = 'h-8 w-8', textClass = 'text-xl font-bold' }) => (
  <Link to="/" className="flex items-center gap-2 no-underline">
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="var(--primary-600)" />
      <path d="M8 22V10l8 6 8-6v12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="10" r="2" fill="#fff" />
    </svg>
    <span className={`${textClass} text-gray-900`}>
      <span className="text-indigo-600">H</span>RIS
    </span>
  </Link>
);

export default Logo;
