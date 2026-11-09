import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';
import WeightScreen from '../features/weight/WeightScreen';
import HabitatScreen from '../features/habitat/HabitatScreen';
import CareTasksScreen from '../features/care/CareTasksScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="pets/:id/weight" element={<WeightScreen />} />
        <Route path="pets/:id/habitat" element={<HabitatScreen />} />
        <Route path="pets/:id/care" element={<CareTasksScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
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
