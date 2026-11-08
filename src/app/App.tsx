import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
