import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import RoleSelection from './pages/RoleSelection';  // ✅ Fixed import typo
import AdminHome from './pages/Home/AdminHome';
import Login from './pages/Login';
import './App.css';

// Component to handle role selection and navigation
const RoleSelectorWrapper = () => {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    if (role) {
      navigate(`/login/${role.toLowerCase()}`); // Ensure correct lowercase URL structure
    }
  };

  return <RoleSelection onRoleSelection={handleRoleSelect} />;  // ✅ Fixed component name
};

// Define routes properly
const router = createBrowserRouter([
  {
    path: "/",
    element: <RoleSelectorWrapper />
  },
  {
    path: "/login/:role",
    element: <Login />
  },
  {
    path: "/admin/home",
    element: <AdminHome />
  },
]);

// Main App Component
function App() {
  return <RouterProvider router={router} />;
}

export default App;
