import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">HRIS</h1>
          <p className="text-gray-500 mt-1">Human Resource Information System</p>
        </div>
        <div className="card p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
